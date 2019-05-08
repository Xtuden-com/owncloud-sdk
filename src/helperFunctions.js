const Promise = require('promise')
const request = require('browser-request')
const parser = require('./xmlParser.js')
const utf8 = require('utf8')
const FileInfo = require('./fileInfo.js')
const uuidv4 = require('uuid/v4')

function helpers () {
  this.OCS_BASEPATH = 'ocs/v1.php/'
  this.OCS_BASEPATH_V2 = 'ocs/v2.php/'
  this.OCS_SERVICE_SHARE = 'apps/files_sharing/api/v1'
  this.OCS_SERVICE_PRIVATEDATA = 'privatedata'
  this.OCS_SERVICE_CLOUD = 'cloud'

  // constants from lib/public/constants.php
  this.OCS_PERMISSION_READ = 1
  this.OCS_PERMISSION_UPDATE = 2
  this.OCS_PERMISSION_CREATE = 4
  this.OCS_PERMISSION_DELETE = 8
  this.OCS_PERMISSION_SHARE = 16
  this.OCS_PERMISSION_ALL = 31

  // constants from lib/public/share.php
  this.OCS_SHARE_TYPE_USER = 0
  this.OCS_SHARE_TYPE_GROUP = 1
  this.OCS_SHARE_TYPE_LINK = 3
  this.OCS_SHARE_TYPE_REMOTE = 6

  this.instance = null
  this._authHeader = null
  this._version = null
  this._capabilities = null
  this._currentUser = null
}

/**
 * sets the OC instance
 * @param   {string}    instance    instance to be used for communication
 */
helpers.prototype.setInstance = function (instance) {
  this.instance = instance
  this._webdavUrl = this.instance + 'remote.php/webdav'
  this._davPath = this.instance + 'remote.php/dav'
}

helpers.prototype.getInstance = function () {
  return this.instance
}

/**
 * sets the username
 * @param   {string}    authHeader    authorization header; either basic or bearer or what ever
 */
helpers.prototype.setAuthorization = function (authHeader) {
  this._authHeader = authHeader
}

helpers.prototype.getAuthorization = function () {
  return this._authHeader
}

helpers.prototype.logout = function () {
  this._authHeader = null
  this._version = null
  this._capabilities = null
  this._currentUser = null
}

/**
 * gets the OC version
 * @returns {string}    OC version
 */
helpers.prototype.getVersion = function () {
  return this._version
}

/**
 * Gets all capabilities of the logged in user
 * @returns {object}    all capabilities
 */
helpers.prototype.getCapabilities = function () {
  return this._capabilities
}

/**
 * Gets the logged in user
 * @returns {object}    user info
 */
helpers.prototype.getCurrentUser = function () {
  return this._currentUser
}

helpers.prototype.getCurrentUserAsync = function () {
  const user = this.getCurrentUser()
  /* jshint unused: false */
  return new Promise((resolve, reject) => {
    if (user === null) {
      this._updateCurrentUser()
        .then(body => {
          resolve(body)
        }).catch(error => {
          reject(error)
        })
    } else {
      resolve(user)
    }
  })
}

/**
 * Sets the logged in user
 * @param {object}  userInfo user info
 */
helpers.prototype.setCurrentUser = function (userInfo) {
  this._currentUser = userInfo
}

/**
 * Updates the capabilities of user logging in.
 * @returns {Promise.<capabilities>}    object: all capabilities
 * @returns {Promise.<error>}           string: error message, if any.
 */
helpers.prototype._updateCapabilities = function () {
  var self = this
  return new Promise((resolve, reject) => {
    self._makeOCSrequest('GET', self.OCS_SERVICE_CLOUD, 'capabilities')
      .then(data => {
        var body = data.data.ocs.data

        self._capabilities = body.capabilities
        self._version = body.version.string + '-' + body.version.edition
        self._versionNumber = body.version.major + '.' + body.version.minor + '.' + body.version.micro

        resolve(self._capabilities)
      }).catch(error => {
        reject(error)
      })
  })
}

/**
 * Updates the user logging in.
 * @returns {Promise.<_currentUser>}    object: _currentUser
 * @returns {Promise.<error>}           string: error message, if any.
 */
helpers.prototype._updateCurrentUser = function () {
  var self = this
  return new Promise((resolve, reject) => {
    self._makeOCSrequest('GET', self.OCS_SERVICE_CLOUD, 'user')
      .then(data => {
        var body = data.data.ocs.data

        self._currentUser = body

        resolve(self._currentUser)
      }).catch(error => {
        reject(error)
      })
  })
}

helpers.prototype.buildHeaders = function () {
  var headers = {
    authorization: this._authHeader,
    'OCS-APIREQUEST': true
  }
  if (this.atLeastVersion('10.1.0')) {
    headers['X-Request-ID'] = uuidv4()
  }
  return headers
}

helpers.prototype.atLeastVersion = function (minVersion) {
  if (typeof this._versionNumber === 'undefined') {
    return false
  }
  const semver = require('semver')
  return semver.gte(this._versionNumber, minVersion)
}

/**
 * Makes an OCS API request.
 * @param   {string} method     method of request (GET, POST etc.)
 * @param   {string} service    service (cloud, privatedata etc.)
 * @param   {string} action     action (apps?filter=enabled, capabilities etc.)
 * @param   {string} [data]     formData for POST and PUT requests
 * @returns {Promise.<data>}    object: {response: response, body: request body}
 * @returns {Promise.<error>}   string: error message, if any.
 */
helpers.prototype._makeOCSrequest = function (method, service, action, data) {
  var self = this

  // Set the headers
  var headers = this.buildHeaders()
  headers['OCS-APIREQUEST'] = true

  var slash = ''

  if (service) {
    slash = '/'
  }
  var path = this.OCS_BASEPATH + service + slash + action

  // Configure the request
  var options = {
    url: this.instance + path,
    method: method,
    headers: headers
  }

  var serialize = function (obj) {
    var str = []
    for (var p in obj) {
      if (obj.hasOwnProperty(p)) {
        str.push(encodeURIComponent(p) + '=' + encodeURIComponent(obj[p]))
      }
    }
    return str.join('&')
  }
  options.headers['content-type'] = 'application/x-www-form-urlencoded'
  options.body = serialize(data).replace(/%20/g, '+')

  return new Promise((resolve, reject) => {
    // Start the request
    request(options, function (error, response, body) {
      if (!self.instance) {
        reject('Please specify a server URL first')
        return
      }

      if (!self._authHeader) {
        reject('Please specify an authorization first.')
        return
      }

      if (error) {
        reject(error)
        return
      }

      let tree = null
      try {
        tree = parser.xml2js(body)
        error = self._checkOCSstatus(tree)
        if (error) {
          reject(error)
          return
        }
      } catch (e) {
        try {
          tree = JSON.parse(body)
          if ('message' in tree) {
            reject(tree.message)
            return
          }
          error = self._checkOCSstatus(tree)
          if (error) {
            reject(error)
            return
          }
        } catch (e) {
          reject('Invalid response body: ' + body)
          return
        }
      }

      resolve({
        response: response,
        body: body,
        data: tree
      })
    })
  })
}

/**
 * performs a simple GET request
 * @param   {string}    url     url to perform GET on
 * @returns {Promise.<data>}    object: {response: response, body: request body}
 * @returns {Promise.<error>}   string: error message, if any.
 */
helpers.prototype._get = function (url) {
  var err = null

  if (!this.instance) {
    err = 'Please specify a server URL first'
  }

  if (!this._authHeader) {
    err = 'Please specify an authorization first.'
  }

  var headers = {
    authorization: this._authHeader,
    'Content-Type': 'application/x-www-form-urlencoded'
  }

  // Configure the request
  var options = {
    url: url,
    method: 'GET',
    headers: headers
  }

  return new Promise((resolve, reject) => {
    if (err) {
      reject(err)
      return
    }

    // Start the request
    request(options, function (error, response, body) {
      if (error) {
        reject(error)
      } else {
        resolve({
          response: response,
          body: body
        })
      }
    })
  })
}

/**
 * Parses a DAV response error.
 */
helpers.prototype._parseDAVerror = function (body) {
  try {
    var tree = parser.xml2js(body)

    if (tree['d:error'] && tree['d:error']['s:message']) {
      return tree['d:error']['s:message']
    }
  } catch (error) {
    return 'Unknown error'
  }
  return 'Unknown error'
}

/**
 * Makes sure path starts with a '/'
 * @param   {string}    path    to the remote file share
 * @returns {string}            normalized path
 */
helpers.prototype._normalizePath = function (path) {
  if (!path) {
    path = ''
  }

  if (path.length === 0) {
    return '/'
  }

  if (path[0] !== '/') {
    path = '/' + path
  }

  return path
}

helpers.prototype._encodeUri = function (path) {
  path = this._normalizePath(path)
  path = encodeURIComponent(path)
  return path.split('%2F').join('/')
}

/**
 * Checks the status code of an OCS request
 * @param   {object} json                         parsed response
 * @param   {array}  [acceptedCodes = [100] ]     array containing accepted codes
 * @returns {string}                              error message or NULL
 */
helpers.prototype._checkOCSstatus = function (json, acceptedCodes) {
  if (!acceptedCodes) {
    acceptedCodes = [100]
  }

  var meta
  if (json.ocs) {
    meta = json.ocs.meta
  }
  var ret

  if (meta && acceptedCodes.indexOf(parseInt(meta.statuscode)) === -1) {
    ret = meta.message

    if (Object.keys(meta.message).length === 0) {
      // no error message returned, return the whole message
      ret = json
    }
  }

  return ret
}

/**
 * Returns the status code of the xml response
 * @param   {object}    json    parsed response
 * @return  {number}           status-code
 */
helpers.prototype._checkOCSstatusCode = function (json) {
  if (json.ocs) {
    var meta = json.ocs.meta
    return parseInt(meta.statuscode)
  }
  return null
}

/**
 * Encodes the string according to UTF-8 standards
 * @param   {string}    path    path to be encoded
 * @returns {string}            encoded path
 */
helpers.prototype._encodeString = function (path) {
  return utf8.encode(path)
}

helpers.prototype._buildFullWebDAVPath = function (path) {
  return this._webdavUrl + this._encodeUri(path)
}

helpers.prototype._buildFullWebDAVPathV2 = function (path) {
  return this._davPath + this._encodeUri(path)
}

/**
 * converts all of object's "true" or "false" entries to booleans
 * @param   {object}    object  object to be typcasted
 * @return  {object}            typecasted object
 */
helpers.prototype._convertObjectToBool = function (object) {
  if (typeof (object) !== 'object') {
    return object
  }

  for (var key in object) {
    if (object[key] === 'true') {
      object[key] = true
    }
    if (object[key] === 'false') {
      object[key] = false
    }
  }

  return object
}

/**
 * Handles Provisionging API boolean response
 */
helpers.prototype._OCSuserResponseHandler = function (data, resolve, reject) {
  var statuscode = parseInt(this._checkOCSstatusCode(data.data))
  if (statuscode === 999) {
    reject('Provisioning API has been disabled at your instance')
  }

  resolve(true)
}

helpers.prototype._parseBody = function (responses, davVersion) {
  if (!Array.isArray(responses)) {
    responses = [responses]
  }
  var self = this
  var fileInfos = []
  for (var i = 0; i < responses.length; i++) {
    var fileInfo = self._parseFileInfo(responses[i], davVersion)
    if (fileInfo !== null) {
      fileInfos.push(fileInfo)
    }
  }
  return fileInfos
}

helpers.prototype._extractPath = function (path, leftTrimComponents) {
  var pathSections = path.split('/')
  pathSections = pathSections.filter(function (section) { return section !== '' })

  let remoteIndex = pathSections.findIndex(section => decodeURIComponent(section) === 'remote.php')
  if (remoteIndex === -1) {
    return null
  }
  if (['webdav', 'dav'].indexOf(decodeURIComponent(pathSections[remoteIndex + 1])) === -1) {
    return null
  }

  // build the sub-path from the remaining sections
  leftTrimComponents = leftTrimComponents || 0
  let subPath = ''
  let i = remoteIndex + leftTrimComponents + 2
  while (i < pathSections.length) {
    subPath += '/' + decodeURIComponent(pathSections[i])
    i++
  }
  return subPath
}

helpers.prototype._parseFileInfo = function (response, davVersion) {
  davVersion = davVersion || 1
  var path = this._extractPath(response.href, davVersion === 2 ? 2 : 0)
  // invalid subpath
  if (path === null) {
    return null
  }
  let name = path

  if (response.propStat.length === 0 || response.propStat[0].status !== 'HTTP/1.1 200 OK') {
    return null
  }

  var props = response.propStat[0].properties
  let fileType = 'file'
  var resType = props['{DAV:}resourcetype']
  if (resType) {
    var xmlvalue = resType[0]
    if (xmlvalue.namespaceURI === 'DAV:' && xmlvalue.nodeName.split(':')[1] === 'collection') {
      fileType = 'dir'
    }
  }

  return new FileInfo(name, fileType, props)
}

helpers.prototype.escapeXml = function (unsafe) {
  if (typeof unsafe !== 'string') {
    return unsafe
  }
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case '\'': return '&apos;'
      case '"': return '&quot;'
    }
  })
}

helpers.prototype.ocs = function (options = {}) {
  let defaults = {
    method: 'GET',
    service: this.OCS_SERVICE_CLOUD,
    action: 'user',
    data: null
  }
  options = Object.assign({}, defaults, options)
  const action = options.action.includes('?') ? options.action + '&format=json' : options.action + '?format=json'
  const url = this.instance + this.OCS_BASEPATH_V2 + options.service + '/' + action
  let headers = this.buildHeaders()
  headers['OCS-APIREQUEST'] = true
  const init = {
    method: options.method,
    mode: 'cors',
    headers: headers
  }
  if (options.data !== null) {
    init.body = JSON.stringify(options.data)
    init.headers['Content-Type'] = 'application/json'
  }
  return fetch(url, init)
}

module.exports = helpers
