fdescribe('Main: Currently testing group management,', function () {
  var OwnCloud = require('../src/owncloud')
  var config = require('./config/config.json')

  // LIBRARY INSTANCE
  var oc

  // PACT setup
  const Pact = require('@pact-foundation/pact-web')
  const provider = new Pact.PactWeb()
  const { setGeneralInteractions, validAuthHeaders, xmlResponseHeaders, ocsMeta } = require('./pactHelper.js')

  beforeEach(function (done) {
    oc = new OwnCloud({
      baseUrl: config.owncloudURL,
      auth: {
        basic: {
          username: config.username,
          password: config.password
        }
      }
    })
    done()
  })

  beforeAll(function (done) {
    const promises = []
    promises.push(setGeneralInteractions(provider))
    promises.push(provider.addInteraction({
      uponReceiving: 'a GET groups request',
      withRequest: {
        method: 'GET',
        path: Pact.Matchers.term({
          matcher: '.*\\/ocs\\/v1\\.php\\/cloud\\/groups$',
          generate: '/ocs/v1.php/cloud/groups'
        }),
        headers: validAuthHeaders
      },
      willRespondWith: {
        status: 200,
        headers: xmlResponseHeaders,
        body: '<?xml version="1.0"?>\n' +
          '<ocs>\n' +
          ocsMeta('ok', '100') +
          ' <data>\n' +
          '  <groups>\n' +
          '   <element>admin</element>\n' +
          '   <element>' + config.testGroup + '</element>\n' +
          '  </groups>\n' +
          ' </data>\n' +
          '</ocs>\n'
      }
    }))
    promises.push(provider.addInteraction({
      uponReceiving: 'a request to GET members of the admin group',
      withRequest: {
        method: 'GET',
        path: Pact.Matchers.term({
          matcher: '.*\\/ocs\\/v1\\.php\\/cloud\\/groups\\/admin$',
          generate: '/ocs/v1.php/cloud/groups/admin'
        }),
        headers: validAuthHeaders
      },
      willRespondWith: {
        status: 200,
        headers: xmlResponseHeaders,
        body: '<?xml version="1.0"?>\n' +
          '<ocs>\n' +
          ocsMeta('ok', '100') +
          ' <data>\n' +
          '  <users>\n' +
          '   <element>admin</element>\n' +
          '  </users>\n' +
          ' </data>\n' +
          '</ocs>\n'
      }
    }))
    promises.push(provider.addInteraction({
      uponReceiving: 'a DELETE request for a non-existent group',
      withRequest: {
        method: 'DELETE',
        path: Pact.Matchers.term({
          matcher: '.*\\/ocs\\/v1\\.php\\/cloud\\/groups\\/' + config.nonExistentGroup + '$',
          generate: '/ocs/v1.php/cloud/groups/' + config.nonExistentGroup
        }),
        headers: validAuthHeaders
      },
      willRespondWith: {
        status: 200,
        headers: xmlResponseHeaders,
        body: '<?xml version="1.0"?>\n' +
          '<ocs>\n' +
          ocsMeta('failure', 101) +
          ' <data/>\n' +
          '</ocs>\n'
      }
    }))
    Promise.all(promises).then(done, done.fail)
  })

  afterAll(function (done) {
    provider.removeInteractions().then(done, done.fail)
  })

  it('checking method : getGroups', function (done) {
    oc.groups.getGroups().then(data => {
      expect(typeof (data)).toBe('object')
      expect(data.indexOf('admin')).toBeGreaterThan(-1)
      expect(data.indexOf(config.testGroup)).toBeGreaterThan(-1)
      done()
    }).catch(error => {
      expect(error).toBe(null)
      done()
    })
  })

  it('checking method : groupExists with an existing group', function (done) {
    oc.groups.groupExists('admin').then(status => {
      expect(status).toBe(true)
      done()
    }).catch(error => {
      expect(error).toBe(null)
      done()
    })
  })
  it('checking method : groupExists with a non-existent group', function (done) {
    oc.groups.groupExists(config.nonExistentGroup).then(status => {
      expect(status).toBe(false)
      done()
    }).catch(error => {
      expect(error).toBe(null)
      done()
    })
  })

  it('checking method : getGroupMembers', function (done) {
    oc.groups.getGroupMembers('admin').then(data => {
      expect(typeof (data)).toBe('object')
      expect(data.indexOf(config.username)).toBeGreaterThan(-1)
      done()
    }).catch(error => {
      expect(error).toBe(null)
      done()
    })
  })

  it('checking method : deleteGroup with a non-existent group', function (done) {
    oc.groups.deleteGroup(config.nonExistentGroup).then(status => {
      expect(status).toBe(null)
      done()
    }).catch(error => {
      expect(typeof (error)).toBe('object')
      expect(error.ocs.meta.statuscode).toEqual('101')
      done()
    })
  })
})
