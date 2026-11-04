const FavoriteModel = require('../models/favoriteModel');

class FavoriteController {
    static async toggleFavorite(req, res, next) {
        try {
            const { userId } = req.params;
            const { hawker_id, stall_id, menu_id } = req.body;

            if (!hawker_id) {
                return res.status(400).json({
                    success: false,
                    message: 'hawker_id is required'
                });
            }

            const result = await FavoriteModel.toggleFavorite(
                parseInt(userId),
                parseInt(hawker_id),
                stall_id ? parseInt(stall_id) : null,
                menu_id !== undefined && menu_id !== null ? parseInt(menu_id) : null
            );

            res.json({
                success: true,
                message: result.action === 'added' ? 'Added to favorites' : 'Removed from favorites',
                data: result
            });
        } catch (error) {
            console.error('Error in toggleFavorite:', error);
            next(error);
        }
    }

    static async getUserFavorites(req, res, next) {
        try {
            const { userId } = req.params;
            const { type } = req.query;

            const favorites = await FavoriteModel.getUserFavorites(
                parseInt(userId),
                type
            );

            res.json({
                success: true,
                data: favorites,
                count: favorites.length
            });
        } catch (error) {
            console.error('Error in getUserFavorites:', error);
            next(error);
        }
    }

    static async getFavoriteCounts(req, res, next) {
        try {
            const { hawkerId } = req.params;
            const { stall_id, menu_id } = req.query;

            const count = await FavoriteModel.getFavoriteCounts(
                parseInt(hawkerId),
                stall_id ? parseInt(stall_id) : null,
                menu_id !== undefined && menu_id !== null ? parseInt(menu_id) : null
            );

            res.json({
                success: true,
                data: {
                    hawker_id: parseInt(hawkerId),
                    stall_id: stall_id ? parseInt(stall_id) : null,
                    menu_id: menu_id !== undefined && menu_id !== null ? parseInt(menu_id) : null,
                    favorite_count: count
                }
            });
        } catch (error) {
            console.error('Error in getFavoriteCounts:', error);
            next(error);
        }
    }

    static async checkFavorited(req, res, next) {
        try {
            const { userId } = req.params;
            const { hawker_id, stall_id, menu_id } = req.query;

            if (!hawker_id) {
                return res.status(400).json({
                    success: false,
                    message: 'hawker_id is required'
                });
            }

            const isFavorited = await FavoriteModel.isFavorited(
                parseInt(userId),
                parseInt(hawker_id),
                stall_id ? parseInt(stall_id) : null,
                menu_id !== undefined && menu_id !== null ? parseInt(menu_id) : null
            );

            res.json({
                success: true,
                data: {
                    user_id: parseInt(userId),
                    hawker_id: parseInt(hawker_id),
                    stall_id: stall_id ? parseInt(stall_id) : null,
                    menu_id: menu_id !== undefined && menu_id !== null ? parseInt(menu_id) : null,
                    is_favorited: isFavorited
                }
            });
        } catch (error) {
            console.error('Error in checkFavorited:', error);
            next(error);
        }
    }

    static async deleteUserFavorites(req, res, next) {
        try {
            const { userId } = req.params;
            const { hawker_id, stall_id, menu_id } = req.body;

            const deletedCount = await FavoriteModel.deleteUserFavorites(
                parseInt(userId),
                hawker_id ? parseInt(hawker_id) : null,
                stall_id !== undefined && stall_id !== null ? parseInt(stall_id) : null,
                menu_id !== undefined && menu_id !== null ? parseInt(menu_id) : null
            );

            res.json({
                success: true,
                message: `Removed ${deletedCount} favorite(s)`,
                data: { deleted_count: deletedCount }
            });
        } catch (error) {
            console.error('Error in deleteUserFavorites:', error);
            next(error);
        }
    }
}

module.exports = FavoriteController;
