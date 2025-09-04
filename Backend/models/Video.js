const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  categoryId: { 
    type: String,
    enum: ['Informatique', 'Marketing', 'Energie', 'Réparation', 'Bureautique'],
    required: true 
  },
  isPaid: { 
    type: Boolean, 
    required: true 
  },
  description: { 
    type: String, 
    required: true 
  },
  videoFileId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  }, // Référence GridFS pour la vidéo
  imageFileId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  },  // Référence GridFS pour l'image
  part: { 
    type: String, 
    enum: ['Hardware', 'Software', 'Partie1', 'Partie2','Social','Contenue'], 
    required: false 
  } 
});

module.exports = mongoose.model('Video', videoSchema);
