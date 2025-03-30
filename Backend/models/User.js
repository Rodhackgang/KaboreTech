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
  isVIPInformatique: { 
    type: Boolean, 
    default: false 
  },
  isVIPMarketing: { 
    type: Boolean, 
    default: false 
  },
  isVIPEnergie: { 
    type: Boolean, 
    default: false 
  },
  isVIPReparation: { 
    type: Boolean, 
    default: false 
  },
  otp: String,
  otpExpiresAt: Date
});

const User = mongoose.model('User', userSchema);
module.exports = User;
