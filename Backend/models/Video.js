const mongoose = require('mongoose');

const Video = mongoose.model('Video', new mongoose.Schema({
  title: { type: String, required: true },
  categoryId: { type: String, required: true },
  part: { type: String, required: true, enum: ['Hardware', 'Software', 'Social', 'Content'] },
  isPaid: { type: Boolean, default: false },
  description: { type: String, default: '' },
  videoFileId: { type: String, required: true }, // ID Google Drive
  imageFileId: { type: String, required: true }, // ID Google Drive
  createdAt: { type: Date, default: Date.now }
}));

module.exports = mongoose.model('Video', Video);
