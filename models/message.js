'use strict'

var mongoose = require('mongoose')
var Schema = mongoose.Schema

var messageSchema = new Schema({

  to: {
    type: Schema.ObjectId,
    ref: 'User',
    required: true
  },

  // signed and PGP-encrypted message
  // TODO: Validate encryption
  content: {
    type: String,
    required: true
  },

  // latitude and longitude
  location: {
    type: [Number],
    required: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
})
messageSchema.index({ location: '2dsphere' })

module.exports = mongoose.model('Message', messageSchema)
