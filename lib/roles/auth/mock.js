var url = require('url')

var express = require('express')
var validator = require('express-validator')

var logger = require('../../util/logger')
var requtil = require('../../util/requtil')
var jwtutil = require('../../util/jwtutil')
var pathutil = require('../../util/pathutil')
var urlutil = require('../../util/urlutil')

module.exports = function(options) {
  var log = logger.createLogger('auth-mock')
    , app = express()

  app.set('view engine', 'jade')
  app.set('views', pathutil.resource('auth/views'))
  app.set('strict routing', true)
  app.set('case sensitive routing', true)

  app.use(express.cookieParser())
  app.use(express.cookieSession({
    secret: options.secret
  , key: options.ssid
  }))
  app.use(express.json())
  app.use(express.urlencoded())
  app.use(express.csrf())
  app.use(validator())
  app.use('/static/lib', express.static(pathutil.resource('lib')))
  app.use('/static', express.static(pathutil.resource('auth')))

  app.use(function(req, res, next) {
    res.cookie('XSRF-TOKEN', req.csrfToken());
    next()
  })

  app.get('/partials/:name', function(req, res) {
    var whitelist = {
      'signin': true
    }

    if (whitelist[req.params.name]) {
      res.render('partials/' + req.params.name)
    }
    else {
      res.send(404)
    }
  })

  app.get('/', function(req, res) {
    res.render('index')
  })

  app.post('/api/v1/auth', function(req, res) {
    var log = logger.createLogger('auth-mock')
    log.setLocalIdentifier(req.ip)
    switch (req.accepts(['json'])) {
      case 'json':
        requtil.validate(req, function() {
            req.checkBody('name').notEmpty()
            req.checkBody('email').isEmail()
          })
          .then(function() {
            log.info('Authenticated "%s"', req.body.email)
            var token = jwtutil.encode({
              payload: {
                email: req.body.email
              , name: req.body.name
              }
            , secret: options.secret
            })
            res.status(200)
              .json({
                success: true
              , redirect: urlutil.addParams(options.appUrl, {
                  jwt: token
                })
              })
          })
          .catch(requtil.ValidationError, function(err) {
            res.status(400)
              .json({
                success: false
              , error: 'ValidationError'
              , validationErrors: err.errors
              })
          })
          .catch(function(err) {
            log.error('Unexpected error', err.stack)
            res.status(500)
              .json({
                success: false
              , error: 'ServerError'
              })
          })
        break
      default:
        res.send(406)
        break
    }
  })

  app.listen(options.port)
  log.info('Listening on port %d', options.port)
}