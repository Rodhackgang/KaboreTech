const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
    title: { type: String, required: true },
    categoryId: { 
      type: String,
      enum: ['Informatique', 'Marketing', 'Energie', 'Réparation'],
      required: true 
    },
    isPaid: { type: Boolean, required: true },
    description: { type: String, required: true },
    videoFileId: { type: mongoose.Schema.Types.ObjectId, required: true }, // Référence GridFS
    imageFileId: { type: mongoose.Schema.Types.ObjectId, required: true }  // Référence GridFS
  });
  
module.exports = mongoose.model('Video', videoSchema);
