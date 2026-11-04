const sql = require('mssql');
const dbConfig = require('../dbConfig');
const closureModel = require('../models/centreClosureModel');
const analyticsModel = require('../models/centreAnalyticsModel');
const satisfactionModel = require('../models/centreSatisfactionModel');
const promotionModel = require('../models/centrePromotionModel');

// Sentiment banding thresholds — deliberately named constants rather than
// hardcoded inline, so they're easy to retune without touching query logic.
const GREEN_MIN_RATING = 4;
const YELLOW_MIN_RATING = 3;
const NEGATIVE_RATING_MAX = 2; // ratings at or below this count as the "red" drill-down

function currentUserId(req) {
  return req.user.id ?? req.user.UserId;
}

function bandFor(avgRating) {
  if (avgRating === null || avgRating === undefined) return 'none';
  if (avgRating >= GREEN_MIN_RATING) return 'green';
  if (avgRating >= YELLOW_MIN_RATING) return 'yellow';
  return 'red';
}

async function isOperatorAssignedToHawker(operatorId, hawkerId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('OperatorId', sql.Int, operatorId)
    .input('HawkerId', sql.Int, hawkerId)
    .query('SELECT 1 FROM OperatorHawkerAssignments WHERE OperatorId = @OperatorId AND HawkerId = @HawkerId');
  return result.recordset.length > 0;
}

async function requireAssignedHawker(req, res, hawkerId) {
  const assigned = await isOperatorAssignedToHawker(currentUserId(req), hawkerId);
  if (!assigned) {
    res.status(403).json({ error: 'You are not assigned to this hawker centre' });
    return false;
  }
  return true;
}

// ---------- Public browse surface: what a diner may see about a centre ----------

async function getCentreStatus(req, res) {
  const hawkerId = Number(req.params.hawkerId);
  if (!hawkerId) return res.status(400).json({ error: 'hawkerId is required' });

  try {
    const [closures, promotions, stallMap] = await Promise.all([
      closureModel.getClosuresForHawker(hawkerId),
      promotionModel.getPromotionsForHawker(hawkerId),
      promotionModel.getPromotionStallMap(hawkerId),
    ]);

    res.json({
      HawkerId: hawkerId,
      closures,
      promotions: promotions.map((p) => ({ ...p, StallIds: stallMap.get(p.PromotionId) || [] })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch centre status' });
  }
}

async function getStallCentreStatus(req, res) {
  const stallId = Number(req.params.stallId);
  if (!stallId) return res.status(400).json({ error: 'stallId is required' });

  try {
    const pool = await sql.connect(dbConfig);
    const stall = await pool
      .request()
      .input('StallId', sql.Int, stallId)
      .query(`
        SELECT s.stallId AS StallId, s.stallName AS StallName,
               c.centreId AS HawkerId, c.centreName AS CentreName
        FROM Stalls s
        JOIN HawkerCentres c ON c.centreId = s.centreId
        WHERE s.stallId = @StallId
      `);

    if (!stall.recordset.length) return res.status(404).json({ error: 'Stall not found' });
    const row = stall.recordset[0];

    const [closures, promotions] = await Promise.all([
      closureModel.getClosuresForHawker(row.HawkerId),
      promotionModel.getPromotionsForStall(stallId),
    ]);

    res.json({ ...row, closures, promotions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stall centre status' });
  }
}

// ---------- Tab 1: Closures & Operating Hours ----------

async function getClosures(req, res) {
  const hawkerId = Number(req.query.hawkerId);
  if (!hawkerId) return res.status(400).json({ error: 'hawkerId is required' });
  if (!(await requireAssignedHawker(req, res, hawkerId))) return;

  try {
    const closures = await closureModel.getClosuresForHawker(hawkerId);
    res.json(closures);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch closures' });
  }
}

async function createClosure(req, res) {
  const { HawkerId, StartDateTime, EndDateTime } = req.body;
  if (!(await requireAssignedHawker(req, res, HawkerId))) return;

  try {
    if (await closureModel.hasOverlap(HawkerId, StartDateTime, EndDateTime)) {
      return res.status(409).json({ error: 'This overlaps an existing scheduled or active closure for this centre' });
    }

    const closureId = await closureModel.createClosure({ ...req.body, CreatedByOperatorId: currentUserId(req) });
    res.status(201).json({ message: 'Closure scheduled', ClosureId: closureId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to schedule closure' });
  }
}

async function endClosure(req, res) {
  try {
    const closure = await closureModel.getClosureById(req.params.id);
    if (!closure) return res.status(404).json({ error: 'Closure not found' });
    if (!(await requireAssignedHawker(req, res, closure.HawkerId))) return;

    const ended = await closureModel.endClosureEarly(closure.ClosureId);
    if (!ended) return res.status(409).json({ error: 'Only an active closure can be ended early' });
    res.json({ message: 'Closure ended' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to end closure' });
  }
}

async function cancelClosure(req, res) {
  try {
    const closure = await closureModel.getClosureById(req.params.id);
    if (!closure) return res.status(404).json({ error: 'Closure not found' });
    if (!(await requireAssignedHawker(req, res, closure.HawkerId))) return;

    const cancelled = await closureModel.cancelClosure(closure.ClosureId);
    if (!cancelled) return res.status(409).json({ error: 'Only a scheduled (future) closure can be cancelled' });
    res.json({ message: 'Closure cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to cancel closure' });
  }
}

// ---------- Tab 2: Operations Analytics ----------

async function getAnalytics(req, res) {
  const hawkerId = Number(req.params.hawkerId);
  const period = req.query.period === 'month' ? 'month' : 'week';
  if (!(await requireAssignedHawker(req, res, hawkerId))) return;

  try {
    const [byHour, byDay, utilisation, total] = await Promise.all([
      analyticsModel.getOrderVolumeByHour(hawkerId, period),
      analyticsModel.getOrderVolumeByDay(hawkerId, period),
      analyticsModel.getStallUtilisation(hawkerId, period),
      analyticsModel.getCentreOrderTotal(hawkerId, period),
    ]);

    const peakHour = byHour.reduce((best, row) => (!best || row.OrderCount > best.OrderCount ? row : best), null);
    const avgPerStall = utilisation.length ? total / utilisation.length : 0;
    const underUtilised = utilisation.filter(s => s.OrderCount < avgPerStall);

    res.json({
      period,
      totalOrders: total,
      orderVolumeByHour: byHour,
      orderVolumeByDay: byDay,
      peakHour: peakHour ? peakHour.HourOfDay : null,
      stallUtilisation: utilisation,
      underUtilisedStalls: underUtilised,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch operations analytics' });
  }
}

// ---------- Tab 3: Satisfaction ----------

async function getSatisfaction(req, res) {
  const hawkerId = Number(req.params.hawkerId);
  if (!(await requireAssignedHawker(req, res, hawkerId))) return;

  try {
    const [stallSummary, stallBreakdown, hawkerSummary, facilityBreakdown, trend] = await Promise.all([
      satisfactionModel.getStallFeedbackSummary(hawkerId),
      satisfactionModel.getStallFeedbackBreakdown(hawkerId),
      satisfactionModel.getHawkerFeedbackSummary(hawkerId),
      satisfactionModel.getHawkerFeedbackFacilityBreakdown(hawkerId),
      satisfactionModel.getHawkerFeedbackTrend(hawkerId),
    ]);

    let trendDirection = 'flat';
    if (trend.RecentAvg != null && trend.PreviousAvg != null) {
      if (trend.RecentAvg > trend.PreviousAvg) trendDirection = 'up';
      else if (trend.RecentAvg < trend.PreviousAvg) trendDirection = 'down';
    }

    res.json({
      stallFeedback: { ...stallSummary, band: bandFor(stallSummary.AvgRating) },
      stallFeedbackBreakdown: stallBreakdown,
      hawkerFeedback: { ...hawkerSummary, band: bandFor(hawkerSummary.AvgRating) },
      facilityBreakdown,
      trend: { ...trend, direction: trendDirection },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch satisfaction data' });
  }
}

async function getNegativeFeedback(req, res) {
  const hawkerId = Number(req.params.hawkerId);
  const source = req.query.source === 'hawker' ? 'hawker' : 'stall';
  if (!(await requireAssignedHawker(req, res, hawkerId))) return;

  try {
    const rows = source === 'hawker'
      ? await satisfactionModel.getNegativeHawkerFeedback(hawkerId, NEGATIVE_RATING_MAX)
      : await satisfactionModel.getNegativeStallFeedback(hawkerId, NEGATIVE_RATING_MAX);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch negative feedback' });
  }
}

// ---------- Tab 4: Promotions ----------

async function getStalls(req, res) {
  const hawkerId = Number(req.query.hawkerId);
  if (!hawkerId) return res.status(400).json({ error: 'hawkerId is required' });
  if (!(await requireAssignedHawker(req, res, hawkerId))) return;

  try {
    const stalls = await promotionModel.getActiveStallsForHawker(hawkerId);
    res.json(stalls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stalls' });
  }
}

async function getPromotions(req, res) {
  const hawkerId = Number(req.query.hawkerId);
  if (!hawkerId) return res.status(400).json({ error: 'hawkerId is required' });
  if (!(await requireAssignedHawker(req, res, hawkerId))) return;

  try {
    const promotions = await promotionModel.getPromotionsForHawker(hawkerId);
    res.json(promotions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch promotions' });
  }
}

async function createPromotion(req, res) {
  const { HawkerId, stallIds } = req.body;
  if (!(await requireAssignedHawker(req, res, HawkerId))) return;

  try {
    if (Array.isArray(stallIds) && !(await promotionModel.stallsBelongToHawker(stallIds, HawkerId))) {
      return res.status(400).json({ error: 'One or more selected stalls do not belong to this hawker centre' });
    }

    const promotionId = await promotionModel.createPromotion(
      { ...req.body, CreatedByOperatorId: currentUserId(req) },
      stallIds
    );
    res.status(201).json({ message: 'Promotion created', PromotionId: promotionId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create promotion' });
  }
}

async function clonePromotion(req, res) {
  try {
    const source = await promotionModel.getPromotionById(req.params.id);
    if (!source) return res.status(404).json({ error: 'Promotion not found' });
    if (!(await requireAssignedHawker(req, res, source.HawkerId))) return;

    const { targetHawkerId } = req.body;
    if (!(await requireAssignedHawker(req, res, targetHawkerId))) return;

    const newPromotionId = await promotionModel.clonePromotion(source, targetHawkerId, currentUserId(req));
    res.status(201).json({ message: 'Promotion cloned. Select target stalls for the new centre.', PromotionId: newPromotionId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clone promotion' });
  }
}


module.exports = {
  getCentreStatus,
  getStallCentreStatus,
  getClosures,
  createClosure,
  endClosure,
  cancelClosure,
  getAnalytics,
  getSatisfaction,
  getNegativeFeedback,
  getStalls,
  getPromotions,
  createPromotion,
  clonePromotion,
};
