fdescribe('Unauthorized: Currently testing file/folder sharing,', function () {
  const OwnCloud = require('../../src')
  const config = require('../config/config.json')

  // LIBRARY INSTANCE
  let oc

  // PACT setup
  const Pact = require('@pact-foundation/pact-web')
  const provider = new Pact.PactWeb()
  const {
    setGeneralInteractions,
    invalidAuthHeader,
    accessControlAllowHeaders,
    accessControlAllowMethods,
    unauthorizedXmlResponseBody
  } = require('../pactHelper.js')

  const unauthorizedResponseXml = {
    status: 401,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': accessControlAllowHeaders,
      'Access-Control-Allow-Methods': accessControlAllowMethods
    },
    body: unauthorizedXmlResponseBody
  }

  beforeAll(function (done) {
    const url = Pact.Matchers.term({
      matcher: '.*\\/ocs\\/v1\\.php\\/apps\\/files_sharing\\/api\\/v1\\/shares.*',
      generate: '/ocs/v1.php/apps/files_sharing/api/v1/shares'
    })
    const promises = []
    promises.push(setGeneralInteractions(provider))
    const requiredMethodsArray = ['POST', 'GET', 'DELETE']
    requiredMethodsArray.forEach(method => {
      promises.push(provider.addInteraction({
        uponReceiving: `a share ${method} request of a file with invalid auth`,
        withRequest: {
          method: method,
          path: url,
          headers: {
            authorization: invalidAuthHeader,
            Origin: origin
          }
        },
        willRespondWith: unauthorizedResponseXml
      }))
    })
    Promise.all(promises).then(done, done.fail)
  })

  afterAll(function (done) {
    provider.removeInteractions().then(done, done.fail)
  })

  // TESTING CONFIGS
  const {
    testUser,
    testFile,
    testFolder,
    testGroup,
    nonExistentFile,
    owncloudURL,
    username,
    password
  } = config

  beforeEach(function () {
    oc = new OwnCloud({
      baseUrl: owncloudURL,
      auth: {
        basic: {
          username: username,
          password: password + new Date().getTime()
        }
      }
    })

    oc.login()
  })

  it('checking method : shareFileWithLink', function (done) {
    oc.shares.shareFileWithLink(testFile).then(share => {
      expect(share).toBe(null)
      done()
    }).catch(error => {
      expect(error).toMatch('Unauthorised')
      done()
    })
  })

  it('checking method : shareFileWithUser', function (done) {
    oc.shares.shareFileWithUser(testFile, testUser).then(share => {
      expect(share).toBe(null)
      done()
    }).catch(error => {
      expect(error).toMatch('Unauthorised')
      done()
    })
  })

  it('checking method : shareFileWithGroup', function (done) {
    oc.shares.shareFileWithGroup(testFile, testGroup, {
      permissions: 19
    }).then(share => {
      expect(share).toEqual(null)
      done()
    }).catch(error => {
      expect(error).toMatch('Unauthorised')
      done()
    })
  })

  it('checking method : isShared', function (done) {
    oc.shares.isShared(nonExistentFile).then(status => {
      expect(status).toBe(null)
      done()
    }).catch(error => {
      expect(error).toMatch('Unauthorised')
      done()
    })
  })

  it('checking method : getShare', function (done) {
    oc.shares.getShare(1).then(share => {
      expect(share).toBe(null)
      done()
    }).catch(error => {
      expect(error).toMatch('Unauthorised')
      done()
    })
  })

  it('checking method : getShares', function (done) {
    oc.shares.getShares(1).then(shares => {
      expect(shares).toBe(null)
      done()
    }).catch(error => {
      expect(error).toMatch('Unauthorised')
      done()
    })
  })

  it('checking method : updateShare', function (done) {
    oc.shares.shareFileWithLink(testFolder).then(share => {
      expect(share).toBe(null)
      done()
    }).catch(error => {
      expect(error).toMatch('Unauthorised')
      done()
    })
  })

  it('checking method : deleteShare', function (done) {
    oc.shares.deleteShare(123).then(status => {
      expect(status).toBe(null)
      done()
    }).catch(error => {
      expect(error).toMatch('Unauthorised')
      done()
    })
  })
})
