const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  phone: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  // Abonnements VIP pour chaque partie spécifique
  isInformatiqueHardware: { 
    type: Boolean, 
    default: false 
  },
  isInformatiqueSoftware: { 
    type: Boolean, 
    default: false 
  },
  isBureautiqueHardware: { 
    type: Boolean, 
    default: false 
  },
  isBureautiqueSoftware: { 
    type: Boolean, 
    default: false 
  },
  isMarketingSocial: { 
    type: Boolean, 
    default: false 
  },
  isMarketingContent: { 
    type: Boolean, 
    default: false 
  },
  isVIPGsmHardware: { 
    type: Boolean, 
    default: false 
  },
  isVIPGsmSoftware: { 
    type: Boolean, 
    default: false 
  },
  otp: String,
  otpExpiresAt: Date
});

const User = mongoose.model('User', userSchema);
module.exports = User;
