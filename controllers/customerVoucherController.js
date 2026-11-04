const VoucherModel = require('../models/voucherModel');

class CustomerVoucherController {
    // Always re-validates server-sideto see if a voucher is valid.
    static async validate(req, res, next) {
        try {
            const { code, stall_id, order_amount } = req.body;

            if (!stall_id) {
                return res.status(400).json({ success: false, valid: false, message: 'stall_id is required' });
            }

            const result = await VoucherModel.validateVoucher(code, parseInt(stall_id), order_amount || 0);

            res.json({
                success: true,
                valid: result.valid,
                message: result.message,
                data: result.valid ? {
                    code: result.voucher.code,
                    discount_type: result.voucher.discountType,
                    discount_value: Number(result.voucher.discountValue),
                    min_order_amount: result.voucher.minOrderAmount == null ? null : Number(result.voucher.minOrderAmount),
                    discount_amount: result.discountAmount
                } : null
            });
        } catch (error) {
            console.error('Error validating voucher:', error);
            next(error);
        }
    }
}

module.exports = CustomerVoucherController;
