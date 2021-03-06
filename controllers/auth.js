'use strict'

var debug = require('debug')('auth')

var routes = require('express').Router()

var config = require('../config')
var User = require('../models/user')

var GoogleOAuth2 = require('google-auth-library/lib/auth/oauth2client')
var googleOAuth2 = new GoogleOAuth2(config.AUTH_GOOGLE_CLIENT_IDS[0])

var errors = {
  badProtocol: 'Please send the request over a TLS connection',
  noToken: 'Missing paramteter `idtoken`',
  invalidClientID: 'Token has been obtained by an invalid client',
  invalidIss: 'The iss must either be accounts.google.com or https://accounts.google.com',
  tokenExpired: 'The expiration date has already been passed'
}

// this accepts an id json web token provided by the google auth client lib.
// information on how to verify can be found on the following page:
// https://developers.google.com/identity/sign-in/web/backend-auth#verify-the-integrity-of-the-id-token
routes.post('/google/verify', function verifyGoogleAuth (req, res, next) {
  // first do basic validation, is it the right protocol?
  if (req.protocol !== 'https') {
    debug('Error: ', errors.badProtocol)

    return res
      .status(400)
      .json({ message: errors.badProtocol })
  }

  // has a token been sent?
  if (!req.body.idtoken) {
    debug('Error: ', errors.noToken)

    return res
      .status(400)
      .json({ message: errors.noToken })
  }

  // Now as advised on the google page
  googleOAuth2.verifyIdToken(req.body.idtoken, config.AUTH_GOOGLE_CLIENT_IDS[0], function idTokenVerified (err, login) {
    if (err) {
      debug('Could not verify ID token', err)
      return next(err)
    }

    debug('Verified identity token')
    var claim = login.getPayload()

    // authentication successful
    var idProvider = 'google-openid-connect'
    User.findOne({
      'idToken.sub': claim.sub,
      'idProvider': idProvider
    }, function (err, user) {
      if (err) return next(err)

      if (user) {
        // if we found a user, just update the identity token and initialize the
        // session

        debug('User logged in again')
        user.idToken = claim
        user.save(function (err) {
          debug('Updated ID token')
          if (err) {
            debug(err.name, err.message)
            return next(err)
          }

          req.session.userId = user._id
          debug('Session set', req.session)
          res.end()
        })
      } else {
        // if not, create the new User and fill in defaults from the ID token
        user = new User({
          idToken: claim,
          idProvider: idProvider,

          keyIdentifier: claim.email,
          alias: claim.name,
          picture: claim.picture
        }).save(function (err) {
          if (err) {
            debug(err.name, err.message)
            return next(err)
          }

          debug('Created user')
          req.session.userId = user._id
          res.end()
        })
      }
    })
  })
})

module.exports = routes
