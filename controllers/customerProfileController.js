const User = require('../models/userModel');

class CustomerProfileController {
    static async getProfile(req, res, next) {
        try {
            const { userId } = req.params;
            const user = await User.findUserById(parseInt(userId));

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            res.json({
                success: true,
                data: {
                    user_id: user.userId,
                    username: user.username,
                    email: user.email,
                    phone: user.contactNumber
                }
            });
        } catch (error) {
            console.error('Error in getProfile:', error);
            next(error);
        }
    }

    // Phone only — username/email are the account's identity, not editable here.
    static async updatePhone(req, res, next) {
        try {
            const { userId } = req.params;
            const { phone } = req.body;

            if (typeof phone !== 'string' || !/^[0-9]{8,12}$/.test(phone)) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number must be 8 to 12 digits.'
                });
            }

            const user = await User.findUserById(parseInt(userId));
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            await User.updateContactNumber(parseInt(userId), phone);

            res.json({
                success: true,
                data: { user_id: user.userId, username: user.username, email: user.email, phone }
            });
        } catch (error) {
            console.error('Error in updatePhone:', error);
            next(error);
        }
    }
}

module.exports = CustomerProfileController;
