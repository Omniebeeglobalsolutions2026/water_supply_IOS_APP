const mongoose = require('mongoose');

const platformSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Number, required: true, min: 1, max: 100 },
  },
  { collection: 'platform_settings', timestamps: true }
);

module.exports = mongoose.model('PlatformSetting', platformSettingSchema);
