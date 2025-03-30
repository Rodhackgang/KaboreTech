const mongoose = require('mongoose');

const expirationSchema = new mongoose.Schema({
  debloquageDate: { 
    type: String, 
    required: true, 
    default: '21/12/2024~23:59' // Valeur par défaut
  },
});

module.exports = mongoose.model('Expiration', expirationSchema);
