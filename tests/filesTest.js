fdescribe('Main: Currently testing files management,', function () {
  const FileInfo = require('../src/fileInfo')
  const OwnCloud = require('../src/owncloud')
  const config = require('./config/config.json')
  const sinon = require('sinon')

  // LIBRARY INSTANCE
  let oc

  // PACT setup
  const Pact = require('@pact-foundation/pact-web')
  const provider = new Pact.PactWeb()
  const { setGeneralInteractions, getContentsOfFile, deleteResource, validAuthHeaders, applicationXmlResponseHeaders, accessControlAllowHeaders, accessControlAllowMethods } = require('./pactHelper.js')

  // TESTING CONFIGS
  const testContent = config.testContent
  const testSubDir = config.testFolder + '/' + 'subdir'
  const nonExistentFile = config.nonExistentFile
  const testSubFiles = [
    config.testFolder + '/' + 'file one.txt',
    config.testFolder + '/' + 'zz+z.txt',
    config.testFolder + '/' + '中文.txt',
    config.testFolder + '/' + 'abc.txt',
    config.testFolder + '/' + 'subdir/in dir.txt'
  ]

  const aMoveRequest = function (name, header, response) {
    return {
      uponReceiving: 'move existent file into same folder, ' + name,
      withRequest: {
        method: 'MOVE',
        path: Pact.Matchers.term({
          matcher: '.*\\/remote\\.php\\/webdav\\/' + config.testFolder + '/%E4%B8%AD%E6%96%87.txt$',
          generate: '/remote.php/webdav/' + config.testFolder + '/%E4%B8%AD%E6%96%87.txt'
        }),
        headers: header
      },
      willRespondWith: response
    }
  }

  const aPropfindRequestToListContentOfFolder = function (name, parentFolder, items, depth) {
    return {
      uponReceiving: 'list content of folder, ' + name,
      withRequest: {
        method: 'PROPFIND',
        path: Pact.Matchers.term({
          matcher: `.*\\/remote\\.php\\/webdav\\/${config.testFolder}$`,
          generate: '/remote.php/webdav/' + config.testFolder
        }),
        headers: {
          ...validAuthHeaders,
          Depth: depth
        },
        body: '<?xml version="1.0"?>\n' +
          '<d:propfind  xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">\n' +
          '  <d:prop>\n' +
          '  </d:prop>\n' +
          '</d:propfind>'
      },
      willRespondWith: {
        status: 207,
        headers: {
          ...applicationXmlResponseHeaders,
          'Access-Control-Allow-Headers': accessControlAllowHeaders,
          'Access-Control-Allow-Methods': accessControlAllowMethods
        },
        body: '<?xml version="1.0"?>\n' +
          '<d:multistatus\n' +
          'xmlns:d="DAV:"\n' +
          'xmlns:s="http://sabredav.org/ns"\n' +
          'xmlns:oc="http://owncloud.org/ns">\n' +
          '<d:response>\n' +
          `<d:href>/core/remote.php/webdav/${parentFolder}/</d:href>\n` +
          '<d:propstat>\n' +
          '<d:prop>\n' +
          '<d:getlastmodified>Mon, 19 Oct 2020 03:50:00 GMT</d:getlastmodified>\n' +
          '<d:resourcetype>\n' +
          '<d:collection/>\n' +
          '</d:resourcetype>\n' +
          '<d:quota-used-bytes>55</d:quota-used-bytes>\n' +
          '<d:quota-available-bytes>-3</d:quota-available-bytes>\n' +
          '<d:getetag>&quot;5f8d0ce8c62b5&quot;</d:getetag>\n' +
          '</d:prop>\n' +
          '<d:status>HTTP/1.1 200 OK</d:status>\n' +
          '</d:propstat>\n' +
          '</d:response>\n' +
          `${listFolderContentResponse(items).join('')}` +
          '</d:multistatus>'
      }
    }
  }

  const listFolderContentResponse = (items) => {
    // let testSub = [
    //   `${config.testFolder}/abc.txt`,
    //   `${config.testFolder}/file one.txt`,
    //   `${config.testFolder}/subdir`,
    //   `${config.testFolder}/subdir/in dir.txt`,
    //   `${config.testFolder}/zz+z.txt`,
    //   `${config.testFolder}/中文.txt`
    //   // `${config.testFolder}/new folder/`
    //   // config.testFolder + '/' + 'subdir',
    //   // config.testFolder + '/' + 'subdir/in dir.txt',
    //   // config.testFolder + '/' + 'zz%2bz.txt',
    //   // config.testFolder + '/' + '/%e4%b8%ad%e6%96%87.txt'
    //   // `${config.testFolder}/中文123.txt`
    // ]
    // if (resourceToAdd) {
    //   testSub.push(resourceToAdd)
    // }
    // if (resourceToRemove) {
    //   testSub = testSub.filter(item => item !== resourceToRemove)
    // }
    // if (depth === '1') {
    //   testSub = testSub.filter(item => item.split('/').length - 1 === 1)
    // }
    const response = []
    for (const subFile of items) {
      response.push('<d:response>\n' +
        `<d:href>/core/remote.php/webdav/${subFile}</d:href>\n` +
        '<d:propstat>\n' +
        '<d:prop>\n' +
        '<d:getlastmodified>Mon, 19 Oct 2020 03:50:00 GMT</d:getlastmodified>\n' +
        '<d:getcontentlength>11</d:getcontentlength>\n' +
        '<d:resourcetype/>\n' +
        '<d:getetag>&quot;3986cd55c130a4d50ff0904bf64aa27d&quot;</d:getetag>\n' +
        '<d:getcontenttype>text/plain</d:getcontenttype>\n' +
        '</d:prop>\n' +
        '<d:status>HTTP/1.1 200 OK</d:status>\n' +
        '</d:propstat>\n' +
        '<d:propstat>\n' +
        '<d:prop>\n' +
        '<d:quota-used-bytes/>\n' +
        '<d:quota-available-bytes/>\n' +
        '</d:prop>\n' +
        '<d:status>HTTP/1.1 404 Not Found</d:status>\n' +
        '</d:propstat>\n' +
        '</d:response>\n')
    }
    return response
  }

  // beforeAll(function (done) {
  //   const promises = []
  //   promises.push(setGeneralInteractions(provider))
  //
  //   // const depths = ['infinity', '2']
  //   // for (const depth of depths) {
  //   //   promises.push(provider.addInteraction(aPropfindRequestToListContentOfFolder('test folder', depth)))
  //   // }
  //
  //   // promises.push(provider.addInteraction(aPropfindRequestToListContentOfFolder(
  //   //   'test folder, with no depth specified',
  //   //   'test folder',
  //   //   [
  //   //     `${config.testFolder}/abc.txt`,
  //   //     `${config.testFolder}/file one.txt`,
  //   //     `${config.testFolder}/subdir`,
  //   //     `${config.testFolder}/zz+z.txt`,
  //   //     `${config.testFolder}/中文.txt`
  //   //   ], '1')))
  //   //
  //   // promises.push(provider.addInteraction(aPropfindRequestToListContentOfFolder(
  //   //   'test folder, with infinity depth',
  //   //   'test folder',
  //   //   [
  //   //     `${config.testFolder}/abc.txt`,
  //   //     `${config.testFolder}/file one.txt`,
  //   //     `${config.testFolder}/subdir`,
  //   //     `${config.testFolder}/subdir/in dir.txt`,
  //   //     `${config.testFolder}/zz+z.txt`,
  //   //     `${config.testFolder}/中文.txt`
  //   //   ], 'infinity')))
  //   //
  //   // promises.push(provider.addInteraction(aPropfindRequestToListContentOfFolder(
  //   //   'test folder, with 2 depth',
  //   //   'test folder',
  //   //   [
  //   //     `${config.testFolder}/abc.txt`,
  //   //     `${config.testFolder}/file one.txt`,
  //   //     `${config.testFolder}/subdir`,
  //   //     `${config.testFolder}/subdir/in dir.txt`,
  //   //     `${config.testFolder}/zz+z.txt`,
  //   //     `${config.testFolder}/中文.txt`
  //   //   ], '2')))
  //
  //   // promises.push(provider.addInteraction(aPropfindRequestToListContentOfFolder(
  //   //   'test folder, after moving existent file into same folder, different name',
  //   //   'test folder',
  //   //   [
  //   //     `${config.testFolder}/abc.txt`,
  //   //     `${config.testFolder}/file one.txt`,
  //   //     `${config.testFolder}/subdir`,
  //   //     `${config.testFolder}/zz+z.txt`,
  //   //     `${config.testFolder}/中文123.txt`
  //   //   ], '1')))
  //
  //   // promises.push(provider.addInteraction(aPropfindRequestToListContentOfFolder('abcdef', '1', 'testFolder/中文123.txt', 'testFolder/中文.txt')))
  //   // promises.push(provider.addInteraction(aPropfindRequestToListContentOfFolder('abcdef', '1', 'testFolder/中文.txt')))
  //   // promises.push(provider.addInteraction(aPropfindRequestToListContentOfFolder('abcdef', '1',  'testFolder/中文.txt', 'testFolder/中文123.txt')))
  //
  //   Promise.all(promises).then(done, done.fail)
  // })
  //
  // afterAll(function (done) {
  //   provider.removeInteractions().then(done, done.fail)
  // })

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

    oc.login().then(status => {
      expect(status).toEqual({ id: 'admin', 'display-name': 'admin', email: {} })
      done()
    }).catch(error => {
      expect(error).toBe(null)
      done()
    })
  })

  afterEach(function () {
    oc.logout()
    oc = null
  })

  describe('file/folder creation and deletion', function () {
    beforeAll(function (done) {
      Promise.all(setGeneralInteractions(provider)).then(done, done.fail)
    })
    afterAll(function (done) {
      provider.removeInteractions().then(done, done.fail)
    })
    it('creates the testFolder at instance', function (done) {
      oc.files.createFolder(config.testFolder).then(status => {
        expect(status).toBe(true)
        done()
      }).catch(error => {
        expect(error).toBe(null)
        done()
      })
    })

    it('creates subfolder at instance', function (done) {
      oc.files.mkdir(testSubDir).then(status => {
        expect(status).toBe(true)
        done()
      }).catch(error => {
        expect(error).toBe(null)
        done()
      })
    })

    it('creates subfiles at instance', function (done) {
      let count = 0

      for (let i = 0; i < testSubFiles.length; i++) {
        oc.files.putFileContents(testSubFiles[i], testContent).then(status => {
          expect(typeof status).toBe('object')
          count++
          if (count === testSubFiles.length) {
            done()
          }
        }).catch(error => {
          expect(error).toBe(null)
          done()
        })
      }
    })

    it('deletes the test folder at instance', async function (done) {
      await provider.addInteraction(deleteResource(config.testFolder))
      oc.files.delete(config.testFolder).then(status => {
        expect(status).toBe(true)
        done()
      }).catch(error => {
        expect(error).toBe(null)
        done()
      })
    })
  })

  describe('abcdefghi', function () {
    beforeAll(async function (done) {
      const promises = []
      promises.push(setGeneralInteractions(provider))
      promises.push(provider.addInteraction(aPropfindRequestToListContentOfFolder(
        'test folder, with no depth specified',
        'test folder',
        [
          `${config.testFolder}/abc.txt`,
          `${config.testFolder}/file one.txt`,
          `${config.testFolder}/subdir`,
          `${config.testFolder}/zz+z.txt`,
          `${config.testFolder}/中文.txt`
        ], '1')))
      promises.push(provider.addInteraction(aPropfindRequestToListContentOfFolder(
        'test folder, with infinity depth',
        'test folder',
        [
          `${config.testFolder}/abc.txt`,
          `${config.testFolder}/file one.txt`,
          `${config.testFolder}/subdir`,
          `${config.testFolder}/subdir/in dir.txt`,
          `${config.testFolder}/zz+z.txt`,
          `${config.testFolder}/中文.txt`
        ], 'infinity')))

      promises.push(provider.addInteraction(aPropfindRequestToListContentOfFolder(
        'test folder, with 2 depth',
        'test folder',
        [
          `${config.testFolder}/abc.txt`,
          `${config.testFolder}/file one.txt`,
          `${config.testFolder}/subdir`,
          `${config.testFolder}/subdir/in dir.txt`,
          `${config.testFolder}/zz+z.txt`,
          `${config.testFolder}/中文.txt`
        ], '2')))
      promises.push(provider.addInteraction({
        uponReceiving: 'list content of new folder',
        withRequest: {
          method: 'PROPFIND',
          path: Pact.Matchers.term({
            matcher: '.*\\/remote\\.php\\/webdav\\/' + config.testFolder + '\\/new%20folder$',
            generate: '/remote.php/webdav/testFolder/new%20folder'
          }),
          headers: {
            ...validAuthHeaders,
            Depth: '0'
          },
          body: '<?xml version="1.0"?>\n' +
            '<d:propfind  xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">\n' +
            '  <d:prop>\n' +
            '  </d:prop>\n' +
            '</d:propfind>'
        },
        willRespondWith: {
          status: 207,
          headers: {
            ...applicationXmlResponseHeaders,
            'Access-Control-Allow-Headers': accessControlAllowHeaders,
            'Access-Control-Allow-Methods': accessControlAllowMethods
          },
          body: '<?xml version="1.0"?>\n' +
            '<d:multistatus\n' +
            '    xmlns:d="DAV:"\n' +
            '    xmlns:s="http://sabredav.org/ns"\n' +
            '    xmlns:oc="http://owncloud.org/ns">\n' +
            '    <d:response>\n' +
            '        <d:href>/core/remote.php/webdav/testFolder/new%20folder</d:href>\n' +
            '        <d:propstat>\n' +
            '            <d:prop>\n' +
            '                <d:getlastmodified>Fri, 23 Oct 2020 07:40:26 GMT</d:getlastmodified>\n' +
            '                <d:resourcetype>\n' +
            '                    <d:collection/>\n' +
            '                </d:resourcetype>\n' +
            '                <d:quota-used-bytes>0</d:quota-used-bytes>\n' +
            '                <d:quota-available-bytes>-3</d:quota-available-bytes>\n' +
            '                <d:getetag>&quot;5f9288ea6943b&quot;</d:getetag>\n' +
            '            </d:prop>\n' +
            '            <d:status>HTTP/1.1 200 OK</d:status>\n' +
            '        </d:propstat>\n' +
            '    </d:response>\n' +
            '</d:multistatus>'
        }
      }))

      Promise.all(promises).then(done, done.fail)
    })

    afterAll(function (done) {
      provider.removeInteractions().then(done, done.fail)
    })

    it('checking method : list with no depth specified', function (done) {
      oc.files.list(config.testFolder).then(files => {
        expect(typeof (files)).toBe('object')
        expect(files.length).toEqual(6)
        expect(files[1].getName()).toEqual('abc.txt')
        expect(files[2].getName()).toEqual('file one.txt')
        expect(files[3].getName()).toEqual('subdir')
        expect(files[4].getName()).toEqual('zz+z.txt')
        expect(files[5].getName()).toEqual('中文.txt')
        done()
      }).catch(error => {
        expect(error).toBe(null)
        done()
      })
    })

    it('checking method : list with Infinity depth', function (done) {
      oc.files.list(config.testFolder, 'infinity').then(files => {
        expect(typeof (files)).toBe('object')
        expect(files.length).toEqual(7)
        expect(files[3].getName()).toEqual('subdir')
        expect(files[4].getPath()).toEqual('/' + config.testFolder + '/' + 'subdir/')
        done()
      }).catch(error => {
        expect(error).toBe(null)
        done()
      })
    })

    it('checking method : list with 2 depth', function (done) {
      oc.files.list(config.testFolder, 2).then(files => {
        expect(typeof (files)).toBe('object')
        expect(files.length).toEqual(7)
        expect(files[3].getName()).toEqual('subdir')
        expect(files[4].getPath()).toEqual('/' + config.testFolder + '/' + 'subdir/')
        done()
      }).catch(error => {
        expect(error).toBe(null)
        done()
      })
    })

    it('checking method : list with non existent file', async function (done) {
      await provider.addInteraction({
        uponReceiving: 'list content of non existing file',
        withRequest: {
          method: 'PROPFIND',
          path: Pact.Matchers.term({
            matcher: `.*\\/remote\\.php\\/webdav\\/${config.nonExistentFile}`,
            generate: '/remote.php/webdav/' + config.nonExistentFile
          }),
          headers: {
            ...validAuthHeaders,
            Depth: '1'
          },
          body: '<?xml version="1.0"?>\n' +
            '<d:propfind  xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">\n' +
            '  <d:prop>\n' +
            '  </d:prop>\n' +
            '</d:propfind>'
        },
        willRespondWith: {
          status: 404,
          headers: {
            ...applicationXmlResponseHeaders,
            'Access-Control-Allow-Headers': accessControlAllowHeaders,
            'Access-Control-Allow-Methods': accessControlAllowMethods
          },
          body: '<?xml version="1.0" encoding="utf-8"?>\n' +
            '<d:error xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns">\n' +
            '  <s:exception>Sabre\\DAV\\Exception\\NotFound</s:exception>\n' +
            '  <s:message>File with name nonExistentFile could not be located</s:message>\n' +
            '</d:error>'
        }
      })
      oc.files.list(nonExistentFile).then(files => {
        expect(files).toBe(null)
        done()
      }).catch(error => {
        expect(error.message).toBe('File with name ' + nonExistentFile + ' could not be located')
        done()
      })
    })

    it('checking method : getFileContents for existent files', async function (done) {
      let count = 0

      const subFiles = [
        `${config.testFolder}/file%20one.txt`,
        `${config.testFolder}/zz%2Bz.txt`,
        `${config.testFolder}/中文.txt`,
        `${config.testFolder}/abc.txt`,
        `${config.testFolder}/subdir/in%20dir.txt`,
        `${config.testFolder}/%E4%B8%AD%E6%96%87.txt`
      ]
      for (const file of subFiles) {
        await provider.addInteraction(getContentsOfFile(file))
      }
      for (let i = 0; i < testSubFiles.length; i++) {
        oc.files.getFileContents(testSubFiles[i], { resolveWithResponseObject: true }).then((resp) => {
          expect(resp.body).toEqual(testContent)
          expect(resp.headers.ETag).toBeDefined()
          count++
          if (count === testSubFiles.length) {
            done()
          }
        }).catch(error => {
          expect(error).toBe(null)
          done()
        })
      }
    })

    // because called from the browser this is not returning xml but html - needs to be adjusted
    it('checking method : getFileContents for non existent file', async function (done) {
      await provider.addInteraction(getContentsOfFile(nonExistentFile))
      oc.files.getFileContents(nonExistentFile).then(content => {
        expect(content).toBe(null)
        done()
      }).catch(error => {
        expect(error.message).toBe('File with name ' + nonExistentFile + ' could not be located')
        done()
      })
    })

    it('uploads file for an existing parent path', async function () {
      const newFile = config.testFolder + '/' + config.testFile
      await provider.addInteraction(getContentsOfFile(newFile))
      await provider.addInteraction(deleteResource(newFile))
      let progressCalled = false

      const options = {
        onProgress: (progressInfo) => {
          progressCalled = true
        }
      }

      try {
        let status = await oc.files.putFileContents(newFile, testContent, options)
        expect(typeof status).toBe('object')
        expect(progressCalled).toEqual(true)
        const content = await oc.files.getFileContents(newFile)
        expect(content).toEqual(testContent)
        status = await oc.files.delete(newFile)
        expect(status).toEqual(true)
      } catch (error) {
        fail(error)
      }
    })

    it('fails with error when uploading to a non-existent parent path', function (done) {
      oc.files.putFileContents(config.nonExistentDir + '/' + 'file.txt', testContent).then(status => {
        expect(status).toBe(null)
        done()
      }).catch(error => {
        expect(error.message).toBe('File with name ' + config.nonExistentDir + ' could not be located')
        done()
      })
    })

    it('checking method: getFileUrl', function () {
      const url = oc.files.getFileUrl('/foo/bar')
      expect(url).toBe(config.owncloudURL + 'remote.php/webdav/foo/bar')
    })

    it('checking method: getFileUrlV2', function () {
      const url = oc.files.getFileUrlV2('/foo/bar')
      expect(url).toBe(config.owncloudURL + 'remote.php/dav/files/admin/foo/bar')
    })
    it('checking method : mkdir for an existing parent path', async function (done) {
      const newFolder = config.testFolder + '/' + 'new folder'
      await provider.addInteraction(deleteResource(encodeURI(newFolder)))

      oc.files.mkdir(newFolder).then(status => {
        expect(status).toBe(true)
        return oc.files.list(newFolder, 0)
      }).then(folder => {
        folder = folder[0]
        expect(folder.isDir()).toBe(true)
        expect(folder.getName()).toEqual('new folder')
        return oc.files.delete(newFolder)
      }).then(status2 => {
        expect(status2).toEqual(true)
        done()
      }).catch(error => {
        expect(error).toBe(null)
        done()
      })
    })

    it('checking method : mkdir for a non-existent parent path', async function (done) {
      await provider.addInteraction({
        uponReceiving: 'creating a folder in a not existing root',
        withRequest: {
          method: 'MKCOL',
          path: Pact.Matchers.term({
            matcher: '.*\\/remote\\.php\\/webdav\\/' + config.testFolder + '\\/' + config.nonExistentDir + '\\/.*\\/',
            generate: '/remote.php/webdav/' + config.testFolder + '/' + config.nonExistentDir + '/newFolder/'
          }),
          headers: validAuthHeaders
        },
        willRespondWith: {
          status: 409,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Access-Control-Allow-Origin': origin
          },
          body: '<?xml version="1.0" encoding="utf-8"?>\n' +
            '<d:error xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns">\n' +
            '  <s:exception>Sabre\\DAV\\Exception\\Conflict</s:exception>\n' +
            '  <s:message>Parent node does not exist</s:message>\n' +
            '</d:error>\n'
        }
      })
      oc.files.mkdir(config.testFolder + '/' + config.nonExistentDir + '/newFolder/').then(status => {
        expect(status).toBe(null)
        done()
      }).catch(error => {
        expect(error.message).toBe('Parent node does not exist')
        done()
      })
    })

    it('checking method : delete for an existing file', async function (done) {
      const newFolder = testSubDir
      await provider.addInteraction({
        uponReceiving: 'list content of folder, after the folder has been deleted',
        withRequest: {
          method: 'PROPFIND',
          path: Pact.Matchers.term({
            matcher: '.*\\/remote\\.php\\/webdav\\/' + config.testFolder + '\\/subdir',
            generate: '/remote.php/webdav/testFolder/subdir'
          }),
          headers: {
            ...validAuthHeaders,
            Depth: '0'
          },
          body: '<?xml version="1.0"?>\n' +
            '<d:propfind  xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">\n' +
            '  <d:prop>\n' +
            '  </d:prop>\n' +
            '</d:propfind>'
        },
        willRespondWith: {
          status: 404,
          headers: {
            ...applicationXmlResponseHeaders,
            'Access-Control-Allow-Headers': accessControlAllowHeaders,
            'Access-Control-Allow-Methods': accessControlAllowMethods
          },
          body: '<?xml version="1.0" encoding="utf-8"?>\n' +
            '<d:error xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns">\n' +
            '  <s:exception>Sabre\\DAV\\Exception\\NotFound</s:exception>\n' +
            '  <s:message>File with name testFolder/subdir could not be located</s:message>\n' +
            '</d:error>'
        }
      })
      await provider.addInteraction(deleteResource(encodeURI(newFolder)))

      oc.files.mkdir(newFolder).then(status => {
        expect(status).toBe(true)
        return oc.files.list(newFolder, 0)
      }).then(folder => {
        folder = folder[0]
        expect(folder.isDir()).toBe(true)
        expect(folder.getName()).toEqual('subdir')
        return oc.files.delete(newFolder)
      }).then(status2 => {
        expect(status2).toEqual(true)
        return oc.files.list(newFolder, 0)
      }).then(folder2 => {
        fail(folder2)
        done()
      }).catch(error => {
        expect(error.message).toBe('File with name ' + newFolder + ' could not be located')
        done()
      })
    })

    it('checking method : delete for a non-existent file', async function (done) {
      await provider.addInteraction(deleteResource(encodeURI(config.nonExistentDir)))
      oc.files.delete(config.nonExistentDir).then(status => {
        expect(status).toBe(null)
        done()
      }).catch(error => {
        expect(error.message).toBe('File with name ' + config.nonExistentDir + ' could not be located')
        done()
      })
    })

    it('checking method : move existent file into same folder, same name', async function (done) {
      await provider.addInteraction(aMoveRequest(
        'same name',
        {
          ...validAuthHeaders,
          Destination: `${config.owncloudURL}remote.php/webdav/testFolder/%E4%B8%AD%E6%96%87.txt`
        },
        {
          status: 403,
          headers: {
            ...applicationXmlResponseHeaders,
            'Access-Control-Allow-Headers': accessControlAllowHeaders,
            'Access-Control-Allow-Methods': accessControlAllowMethods
          },
          body: '<?xml version="1.0" encoding="utf-8"?>\n' +
            '<d:error xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns">\n' +
            '  <s:exception>Sabre\\DAV\\Exception\\Forbidden</s:exception>\n' +
            '  <s:message>Source and destination uri are identical.</s:message>\n' +
            '</d:error>'
        }))
      oc.files.move(config.testFolder + '/中文.txt', config.testFolder + '/中文.txt').then(status => {
        expect(status).toBe(true)
        done()
      }).catch(error => {
        expect(error.message).toBe('Source and destination uri are identical.')
        done()
      })
    })

    // keep together with propfind wiht 1 depth, this and above have matching interaction due to propfind 1
    it('checking method : move existent file into different folder', async function (done) {
      await provider.addInteraction({
        uponReceiving: 'move existent file into different folder',
        withRequest: {
          method: 'MOVE',
          path: Pact.Matchers.term({
            matcher: '.*\\/remote\\.php\\/webdav\\/' + config.testFolder + '/%E4%B8%AD%E6%96%87123.txt$',
            generate: '/remote.php/webdav/' + config.testFolder + '/%E4%B8%AD%E6%96%87123.txt'
          }),
          headers: {
            ...validAuthHeaders,
            Destination: `${config.owncloudURL}remote.php/webdav/testFolder/%E4%B8%AD%E6%96%87.txt`
          }
        },
        willRespondWith: {
          status: 201,
          headers: {
            ...applicationXmlResponseHeaders,
            'Access-Control-Allow-Headers': accessControlAllowHeaders,
            'Access-Control-Allow-Methods': accessControlAllowMethods
          }
        }
      })

      await provider.addInteraction({
        uponReceiving: 'list content of subdir',
        withRequest: {
          method: 'PROPFIND',
          path: Pact.Matchers.term({
            matcher: `.*\\/remote\\.php\\/webdav\\/${config.testFolder}\\/subdir$`,
            generate: '/remote.php/webdav/' + config.testFolder + '/subdir'
          }),
          headers: {
            ...validAuthHeaders,
            Depth: '1'
          },
          body: '<?xml version="1.0"?>\n' +
            '<d:propfind  xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">\n' +
            '  <d:prop>\n' +
            '  </d:prop>\n' +
            '</d:propfind>'
        },
        willRespondWith: {
          status: 207,
          headers: {
            ...applicationXmlResponseHeaders,
            'Access-Control-Allow-Headers': accessControlAllowHeaders,
            'Access-Control-Allow-Methods': accessControlAllowMethods
          },
          body: '<?xml version="1.0"?>\n' +
            '<d:multistatus\n' +
            '    xmlns:d="DAV:"\n' +
            '    xmlns:s="http://sabredav.org/ns"\n' +
            '    xmlns:oc="http://owncloud.org/ns">\n' +
            '    <d:response>\n' +
            '        <d:href>/core/remote.php/webdav/testFolder/subdir/</d:href>\n' +
            '        <d:propstat>\n' +
            '            <d:prop>\n' +
            '                <d:getlastmodified>Tue, 10 Nov 2020 07:29:35 GMT</d:getlastmodified>\n' +
            '                <d:resourcetype>\n' +
            '                    <d:collection/>\n' +
            '                </d:resourcetype>\n' +
            '                <d:quota-used-bytes>6</d:quota-used-bytes>\n' +
            '                <d:quota-available-bytes>-3</d:quota-available-bytes>\n' +
            '                <d:getetag>&quot;5faa415f23d81&quot;</d:getetag>\n' +
            '            </d:prop>\n' +
            '            <d:status>HTTP/1.1 200 OK</d:status>\n' +
            '        </d:propstat>\n' +
            '    </d:response>\n' +
            '    <d:response>\n' +
            '        <d:href>/core/remote.php/webdav/testFolder/subdir/in%20dir.txt</d:href>\n' +
            '        <d:propstat>\n' +
            '            <d:prop>\n' +
            '                <d:getlastmodified>Tue, 10 Nov 2020 07:29:35 GMT</d:getlastmodified>\n' +
            '                <d:getcontentlength>6</d:getcontentlength>\n' +
            '                <d:resourcetype/>\n' +
            '                <d:getetag>&quot;d5b85791a51514922838bfd3af517e47&quot;</d:getetag>\n' +
            '                <d:getcontenttype>text/plain</d:getcontenttype>\n' +
            '            </d:prop>\n' +
            '            <d:status>HTTP/1.1 200 OK</d:status>\n' +
            '        </d:propstat>\n' +
            '        <d:propstat>\n' +
            '            <d:prop>\n' +
            '                <d:quota-used-bytes/>\n' +
            '                <d:quota-available-bytes/>\n' +
            '            </d:prop>\n' +
            '            <d:status>HTTP/1.1 404 Not Found</d:status>\n' +
            '        </d:propstat>\n' +
            '    </d:response>\n' +
            '</d:multistatus>'
        }
      })

      oc.files.move(config.testFolder + '/中文123.txt', config.testFolder + '/中文.txt').then(status => {
        expect(status).toBe(true)
        return oc.files.list(config.testFolder + '/subdir')
      }).then(files => {
        const fileNames = []
        for (let i = 0; i < files.length; i++) {
          fileNames.push(files[i].getName())
        }
        expect(fileNames.indexOf('中文.txt')).toBe(-1)
        return oc.files.list(config.testFolder)
      }).then(files2 => {
        const fileNames = []
        for (let i = 0; i < files2.length; i++) {
          fileNames.push(files2[i].getName())
        }
        expect(fileNames.indexOf('中文123.txt')).toBe(-1)
        expect(fileNames.indexOf('中文.txt')).toBeGreaterThan(-1)
        done()
      }).catch(error => {
        expect(error).toBe(null)
        done()
      })
    })

    it('checking method : move non existent file', async function (done) {
      await provider.addInteraction({
        uponReceiving: 'move non existent file',
        withRequest: {
          method: 'MOVE',
          path: Pact.Matchers.term({
            matcher: '.*\\/remote\\.php\\/webdav\\/' + config.nonExistentFile + '$',
            generate: `/remote.php/webdav/${config.nonExistentFile}`
          }),
          headers: {
            ...validAuthHeaders,
            Destination: `${config.owncloudURL}remote.php/webdav/abcd.txt`
          }
        },
        willRespondWith: {
          status: 404,
          headers: {
            ...applicationXmlResponseHeaders,
            'Access-Control-Allow-Headers': accessControlAllowHeaders,
            'Access-Control-Allow-Methods': accessControlAllowMethods
          },
          body: '<?xml version="1.0" encoding="utf-8"?>\n' +
            '<d:error xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns">\n' +
            '  <s:exception>Sabre\\DAV\\Exception\\NotFound</s:exception>\n' +
            '  <s:message>File with name nonExistentFile could not be located</s:message>\n' +
            '</d:error>'
        }
      })
      oc.files.move(nonExistentFile, '/abcd.txt').then(status => {
        expect(status).toBe(null)
        done()
      }).catch(error => {
        expect(error.message).toBe('File with name ' + nonExistentFile + ' could not be located')
        done()
      })
    })

    it('checking method : copy existent file into same folder, same name', async function (done) {
      await provider.addInteraction({
        uponReceiving: 'copy existent file into same folder, same name',
        withRequest: {
          method: 'COPY',
          path: Pact.Matchers.term({
            matcher: '.*\\/remote\\.php\\/webdav\\/' + config.testFolder + '/%E4%B8%AD%E6%96%87.txt$',
            generate: '/remote.php/webdav/' + config.testFolder + '/%E4%B8%AD%E6%96%87.txt'
          }),
          headers: {
            ...validAuthHeaders,
            Destination: `${config.owncloudURL}remote.php/webdav/testFolder/%E4%B8%AD%E6%96%87.txt`
          }
        },
        willRespondWith: {
          status: 403,
          headers: {
            ...applicationXmlResponseHeaders,
            'Access-Control-Allow-Headers': accessControlAllowHeaders,
            'Access-Control-Allow-Methods': accessControlAllowMethods
          },
          body: '<?xml version="1.0" encoding="utf-8"?>\n' +
            '<d:error xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns">\n' +
            '  <s:exception>Sabre\\DAV\\Exception\\Forbidden</s:exception>\n' +
            '  <s:message>Source and destination uri are identical.</s:message>\n' +
            '</d:error>'
        }
      })

      oc.files.copy(config.testFolder + '/中文.txt', config.testFolder + '/中文.txt').then(status => {
        expect(status).toBe(true)
        done()
      }).catch(error => {
        expect(error.message).toBe('Source and destination uri are identical.')
        done()
      })
    })

    it('checking method : copy non existent file', async function (done) {
      await provider.addInteraction({
        uponReceiving: 'copy non existent file',
        withRequest: {
          method: 'COPY',
          path: Pact.Matchers.term({
            matcher: '.*\\/remote\\.php\\/webdav\\/' + config.nonExistentFile + '$',
            generate: '/remote.php/webdav/' + config.nonExistentFile
          }),
          headers: {
            ...validAuthHeaders,
            Destination: `${config.owncloudURL}remote.php/webdav/abcd.txt`
          }
        },
        willRespondWith: {
          status: 404,
          headers: {
            ...applicationXmlResponseHeaders,
            'Access-Control-Allow-Headers': accessControlAllowHeaders,
            'Access-Control-Allow-Methods': accessControlAllowMethods
          },
          body: '<?xml version="1.0" encoding="utf-8"?>\n' +
            '<d:error xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns">\n' +
            '  <s:exception>Sabre\\DAV\\Exception\\NotFound</s:exception>\n' +
            '  <s:message>File with name nonExistentFile could not be located</s:message>\n' +
            '</d:error>'
        }
      })

      oc.files.copy(nonExistentFile, '/abcd.txt').then(status => {
        expect(status).toBe(null)
        done()
      }).catch(error => {
        expect(error.message).toBe('File with name ' + nonExistentFile + ' could not be located')
        done()
      })
    })

    it('resolved the path of a file identified by its fileId', async function (done) {
      await provider.addInteraction({
        uponReceiving: 'PROPFIND path for fileId',
        withRequest: {
          method: 'PROPFIND',
          path: Pact.Matchers.term({
            matcher: '.*\\/remote\\.php\\/dav\\/meta\\/123456789',
            generate: '/remote.php/dav/meta/123456789'
          }),
          headers: validAuthHeaders,
          body: '<?xml version="1.0"?>\n' +
            '<d:propfind  xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">\n' +
            '  <d:prop>\n' +
            '    <oc:meta-path-for-user />\n' +
            '  </d:prop>\n' +
            '</d:propfind>'
        },
        willRespondWith: {
          status: 207,
          headers: {
            ...applicationXmlResponseHeaders,
            'Access-Control-Allow-Headers': accessControlAllowHeaders,
            'Access-Control-Allow-Methods': accessControlAllowMethods
          },
          body: '<?xml version="1.0"?>\n' +
            '<d:multistatus\n' +
            '    xmlns:d="DAV:"\n' +
            '    xmlns:s="http://sabredav.org/ns"\n' +
            '    xmlns:oc="http://owncloud.org/ns">\n' +
            '    <d:response>\n' +
            '        <d:href>/core/remote.php/dav/meta/123456789/</d:href>\n' +
            '        <d:propstat>\n' +
            '            <d:prop>\n' +
            '                <oc:meta-path-for-user>/testFolder/testFile.txt</oc:meta-path-for-user>\n' +
            '            </d:prop>\n' +
            '            <d:status>HTTP/1.1 200 OK</d:status>\n' +
            '        </d:propstat>\n' +
            '    </d:response>\n' +
            '</d:multistatus>'
        }
      })

      await provider.addInteraction({
        uponReceiving: 'PROPFIND file info, fileId',
        withRequest: {
          method: 'PROPFIND',
          path: Pact.Matchers.term({
            matcher: `.*\\/remote\\.php\\/webdav\\/${config.testFolder}\\/${config.testFile}`,
            generate: `/remote.php/webdav/${config.testFolder}/${config.testFile}`
          }),
          headers: validAuthHeaders,
          body: '<?xml version="1.0"?>\n' +
            '<d:propfind  xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">\n' +
            '  <d:prop>\n' +
            '    <oc:fileid />\n' +
            '  </d:prop>\n' +
            '</d:propfind>'
        },
        willRespondWith: {
          status: 207,
          headers: {
            ...applicationXmlResponseHeaders,
            'Access-Control-Allow-Headers': accessControlAllowHeaders,
            'Access-Control-Allow-Methods': accessControlAllowMethods
          },
          body: '<?xml version="1.0"?>\n' +
            '<d:multistatus\n' +
            '    xmlns:d="DAV:"\n' +
            '    xmlns:s="http://sabredav.org/ns"\n' +
            '    xmlns:oc="http://owncloud.org/ns">\n' +
            '    <d:response>\n' +
            `        <d:href>/remote.php/webdav/${config.testFolder}/${config.testFile}</d:href>\n` +
            '        <d:propstat>\n' +
            '            <d:prop>\n' +
            '                <oc:fileid>123456789</oc:fileid>\n' +
            '            </d:prop>\n' +
            '            <d:status>HTTP/1.1 200 OK</d:status>\n' +
            '        </d:propstat>\n' +
            '    </d:response>\n' +
            '</d:multistatus>'
        }
      })

      const newFile = config.testFolder + '/' + config.testFile

      oc.files.putFileContents(newFile, config.testContent).then(() => {
        return oc.files.fileInfo(newFile, ['{http://owncloud.org/ns}fileid'])
      }).then(fileInfo => {
        const fileId = fileInfo.getFileId()
        return oc.files.getPathForFileId(fileId)
      }).then(path => {
        expect(path).toEqual('/' + newFile)
        done()
      }).catch(error => {
        expect(error).toBe(null)
        done()
      })
    })
  })

  describe('TUS detection', function () {
    let parseBodyStub
    let xhr
    let requests

    beforeAll(async function (done) {
      const promises = []
      promises.push(setGeneralInteractions(provider))
      Promise.all(promises).then(done, done.fail)
    })

    afterAll(function (done) {
      provider.removeInteractions().then(done, done.fail)
    })

    beforeEach(function () {
      xhr = sinon.useFakeXMLHttpRequest()
      requests = []
      xhr.onCreate = function (xhr) {
        requests.push(xhr)
      }
      const dummyFileInfo1 = new FileInfo('dummy', 'dir', {})
      const dummyFileInfo2 = new FileInfo('dummy2', 'dir', {})
      parseBodyStub = sinon.stub(oc.helpers, '_parseBody').returns([dummyFileInfo1, dummyFileInfo2])
    })

    afterEach(function () {
      parseBodyStub.restore()
      xhr.restore()
    })

    it('returns TUS support information when TUS headers are set for a list call', function (done) {
      const promise = oc.files.list('')
      promise.then(entries => {
        const tusSupport = entries[0].getTusSupport()
        expect(tusSupport.resumable).toEqual('1.0.0')
        expect(tusSupport.version).toEqual(['1.0.0', '0.2.1', '0.1.1'])
        expect(tusSupport.extension).toEqual(['create', 'create-with-upload'])
        expect(tusSupport.maxSize).toEqual(100000000)
        // only the first entry gets the header
        expect(entries[1].getTusSupport()).toEqual(null)
        done()
      })
      requests[0].respond(
        207, {
          'Content-Type': 'application/xml',
          'Tus-Resumable': '1.0.0',
          'Tus-Version': '1.0.0,0.2.1,0.1.1',
          'Tus-Extension': 'create,create-with-upload',
          'Tus-Max-Size': '100000000'
        },
        '<dummy></dummy>' // irrelevant parsing skipped with parseBodyStub
      )
    })
    it('returns TUS support information when TUS headers are set for a fileinfo call', function (done) {
      const promise = oc.files.fileInfo('somedir')
      promise.then(entry => {
        const tusSupport = entry.getTusSupport()
        expect(tusSupport.resumable).toEqual('1.0.0')
        expect(tusSupport.version).toEqual(['1.0.0', '0.2.1', '0.1.1'])
        expect(tusSupport.extension).toEqual(['create', 'create-with-upload'])
        expect(tusSupport.maxSize).toEqual(100000000)
        done()
      })
      requests[0].respond(
        207, {
          'Content-Type': 'application/xml',
          'Tus-Resumable': '1.0.0',
          'Tus-Version': '1.0.0,0.2.1,0.1.1',
          'Tus-Extension': 'create,create-with-upload',
          'Tus-Max-Size': '100000000'
        },
        '<dummy></dummy>' // irrelevant parsing skipped with parseBodyStub
      )
    })
    it('returns null when TUS headers are not set for a list call', function (done) {
      const promise = oc.files.list('')
      promise.then(entries => {
        expect(entries[0].getTusSupport()).toEqual(null)
        expect(entries[1].getTusSupport()).toEqual(null)
        done()
      })
      requests[0].respond(
        207, {
          'Content-Type': 'application/xml'
        },
        '<dummy></dummy>' // irrelevant parsing skipped with parseBodyStub
      )
    })
  })

  describe('move existent file into same folder, different name', function () {
    beforeAll(async function (done) {
      const promises = []
      // provider.removeInteractions().then(done, done.fail)
      promises.push(setGeneralInteractions(provider))
      promises.push(provider.addInteraction(aPropfindRequestToListContentOfFolder(
        'test folder, after moving existent file into same folder, different name',
        'test folder',
        [
          `${config.testFolder}/abc.txt`,
          `${config.testFolder}/file one.txt`,
          `${config.testFolder}/subdir`,
          `${config.testFolder}/zz+z.txt`,
          `${config.testFolder}/中文123.txt`
        ], '1')))
      Promise.all(promises).then(done, done.fail)
    })

    afterAll(function (done) {
      provider.removeInteractions().then(done, done.fail)
    })

    // conflicts with propfind with depth 1
    it('checking method : move existent file into same folder, different name', async function (done) {
      await provider.addInteraction(aMoveRequest(
        'different name',
        {
          ...validAuthHeaders,
          Destination: `${config.owncloudURL}remote.php/webdav/testFolder/%E4%B8%AD%E6%96%87123.txt`
        },
        {
          status: 201,
          headers: {
            ...applicationXmlResponseHeaders,
            'Access-Control-Allow-Headers': accessControlAllowHeaders,
            'Access-Control-Allow-Methods': accessControlAllowMethods
          }
        }))
      oc.files.move(config.testFolder + '/中文.txt', config.testFolder + '/中文123.txt').then(status => {
        expect(status).toBe(true)
        return oc.files.list(config.testFolder)
      }).then(files => {
        const fileNames = []
        for (let i = 0; i < files.length; i++) {
          fileNames.push(files[i].getName())
        }
        expect(fileNames.indexOf('中文123.txt')).toBeGreaterThan(-1)
        expect(fileNames.indexOf('中文.txt')).toBe(-1)
        done()
      }).catch(error => {
        expect(error).toBe(null)
        done()
      })
    })
  })

  describe('abcdefghi', function () {
    beforeAll(async function (done) {
      const promises = []
      promises.push(setGeneralInteractions(provider))
      promises.push(provider.addInteraction(aPropfindRequestToListContentOfFolder(
        'test folder, after copying existent file into different name',
        'test folder',
        [
          `${config.testFolder}/abc.txt`,
          `${config.testFolder}/file one.txt`,
          `${config.testFolder}/subdir`,
          `${config.testFolder}/zz+z.txt`,
          `${config.testFolder}/中文.txt`,
          `${config.testFolder}/中文123.txt`
        ], '1')))
      Promise.all(promises).then(done, done.fail)
    })

    afterAll(function (done) {
      provider.removeInteractions().then(done, done.fail)
    })
    // skipped: add testFolder/中文123.txt and propfind
    it('checking method : copy existent file into same folder, different name', async function (done) {
      await provider.addInteraction({
        uponReceiving: 'copy existent file into same folder, different name',
        withRequest: {
          method: 'COPY',
          path: Pact.Matchers.term({
            matcher: '.*\\/remote\\.php\\/webdav\\/' + config.testFolder + '/%E4%B8%AD%E6%96%87.txt$',
            generate: '/remote.php/webdav/' + config.testFolder + '/%E4%B8%AD%E6%96%87.txt'
          }),
          headers: {
            ...validAuthHeaders,
            Destination: `${config.owncloudURL}remote.php/webdav/testFolder/%E4%B8%AD%E6%96%87123.txt`
          }
        },
        willRespondWith: {
          status: 201,
          headers: {
            ...applicationXmlResponseHeaders,
            'Access-Control-Allow-Headers': accessControlAllowHeaders,
            'Access-Control-Allow-Methods': accessControlAllowMethods
          }
        }
      })

      oc.files.copy(config.testFolder + '/中文.txt', config.testFolder + '/中文123.txt').then(status => {
        expect(status).toBe(true)
        return oc.files.list(config.testFolder)
      }).then(files => {
        const fileNames = []
        for (let i = 0; i < files.length; i++) {
          fileNames.push(files[i].getName())
        }
        expect(fileNames.indexOf('中文123.txt')).toBeGreaterThan(-1)
        expect(fileNames.indexOf('中文.txt')).toBeGreaterThan(-1)
        done()
      }).catch(error => {
        expect(error).toBe(null)
        done()
      })
    })

    // skipped: add testFolder/中文123.txt and propfind
    it('checking method : copy existent file into different folder', async function (done) {
      await provider.addInteraction({
        uponReceiving: 'list content of subdir1',
        withRequest: {
          method: 'PROPFIND',
          path: Pact.Matchers.term({
            matcher: `.*\\/remote\\.php\\/webdav\\/${config.testFolder}\\/subdir$`,
            generate: '/remote.php/webdav/' + config.testFolder + '/subdir'
          }),
          headers: {
            ...validAuthHeaders,
            Depth: '1'
          },
          body: '<?xml version="1.0"?>\n' +
            '<d:propfind  xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">\n' +
            '  <d:prop>\n' +
            '  </d:prop>\n' +
            '</d:propfind>'
        },
        willRespondWith: {
          status: 207,
          headers: {
            ...applicationXmlResponseHeaders,
            'Access-Control-Allow-Headers': accessControlAllowHeaders,
            'Access-Control-Allow-Methods': accessControlAllowMethods
          },
          body: '<?xml version="1.0"?>\n' +
            '<d:multistatus\n' +
            '    xmlns:d="DAV:"\n' +
            '    xmlns:s="http://sabredav.org/ns"\n' +
            '    xmlns:oc="http://owncloud.org/ns">\n' +
            '    <d:response>\n' +
            '        <d:href>/core/remote.php/webdav/testFolder/subdir/</d:href>\n' +
            '        <d:propstat>\n' +
            '            <d:prop>\n' +
            '                <d:getlastmodified>Sun, 08 Nov 2020 15:14:10 GMT</d:getlastmodified>\n' +
            '                <d:resourcetype>\n' +
            '                    <d:collection/>\n' +
            '                </d:resourcetype>\n' +
            '                <d:quota-used-bytes>12</d:quota-used-bytes>\n' +
            '                <d:quota-available-bytes>-3</d:quota-available-bytes>\n' +
            '                <d:getetag>&quot;5fa80b428136c&quot;</d:getetag>\n' +
            '            </d:prop>\n' +
            '            <d:status>HTTP/1.1 200 OK</d:status>\n' +
            '        </d:propstat>\n' +
            '    </d:response>\n' +
            '    <d:response>\n' +
            '        <d:href>/core/remote.php/webdav/testFolder/subdir/in%20dir.txt</d:href>\n' +
            '        <d:propstat>\n' +
            '            <d:prop>\n' +
            '                <d:getlastmodified>Sun, 08 Nov 2020 15:14:08 GMT</d:getlastmodified>\n' +
            '                <d:getcontentlength>6</d:getcontentlength>\n' +
            '                <d:resourcetype/>\n' +
            '                <d:getetag>&quot;ad216ddf7f97b00832be2707e48c5899&quot;</d:getetag>\n' +
            '                <d:getcontenttype>text/plain</d:getcontenttype>\n' +
            '            </d:prop>\n' +
            '            <d:status>HTTP/1.1 200 OK</d:status>\n' +
            '        </d:propstat>\n' +
            '        <d:propstat>\n' +
            '            <d:prop>\n' +
            '                <d:quota-used-bytes/>\n' +
            '                <d:quota-available-bytes/>\n' +
            '            </d:prop>\n' +
            '            <d:status>HTTP/1.1 404 Not Found</d:status>\n' +
            '        </d:propstat>\n' +
            '    </d:response>\n' +
            '    <d:response>\n' +
            '        <d:href>/core/remote.php/webdav/testFolder/subdir/%e4%b8%ad%e6%96%87.txt</d:href>\n' +
            '        <d:propstat>\n' +
            '            <d:prop>\n' +
            '                <d:getlastmodified>Sun, 08 Nov 2020 15:14:10 GMT</d:getlastmodified>\n' +
            '                <d:getcontentlength>6</d:getcontentlength>\n' +
            '                <d:resourcetype/>\n' +
            '                <d:getetag>&quot;101efa7e2f80b8b5783b966fe591db30&quot;</d:getetag>\n' +
            '                <d:getcontenttype>text/plain</d:getcontenttype>\n' +
            '            </d:prop>\n' +
            '            <d:status>HTTP/1.1 200 OK</d:status>\n' +
            '        </d:propstat>\n' +
            '        <d:propstat>\n' +
            '            <d:prop>\n' +
            '                <d:quota-used-bytes/>\n' +
            '                <d:quota-available-bytes/>\n' +
            '            </d:prop>\n' +
            '            <d:status>HTTP/1.1 404 Not Found</d:status>\n' +
            '        </d:propstat>\n' +
            '    </d:response>\n' +
            '</d:multistatus>'
        }
      })

      await provider.addInteraction({
        uponReceiving: 'copy existent file into different folder',
        withRequest: {
          method: 'COPY',
          path: Pact.Matchers.term({
            matcher: '.*\\/remote\\.php\\/webdav\\/' + config.testFolder + '/%E4%B8%AD%E6%96%87123.txt$',
            generate: '/remote.php/webdav/' + config.testFolder + '/%E4%B8%AD%E6%96%87123.txt'
          }),
          headers: {
            ...validAuthHeaders,
            Destination: `${config.owncloudURL}remote.php/webdav/testFolder/subdir/%E4%B8%AD%E6%96%87.txt`
          }
        },
        willRespondWith: {
          status: 201,
          headers: {
            ...applicationXmlResponseHeaders,
            'Access-Control-Allow-Headers': accessControlAllowHeaders,
            'Access-Control-Allow-Methods': accessControlAllowMethods
          }
        }
      })

      oc.files.copy(config.testFolder + '/中文123.txt', config.testFolder + '/subdir/中文.txt').then(status => {
        expect(status).toBe(true)
        return oc.files.list(config.testFolder + '/subdir')
      }).then(files => {
        const fileNames = []
        for (let i = 0; i < files.length; i++) {
          fileNames.push(files[i].getName())
        }
        expect(fileNames.indexOf('中文.txt')).toBeGreaterThan(-1)
        return oc.files.list(config.testFolder)
      }).then(files2 => {
        const fileNames = []
        for (let i = 0; i < files2.length; i++) {
          fileNames.push(files2[i].getName())
        }
        expect(fileNames.indexOf('中文123.txt')).toBeGreaterThan(-1)
        expect(fileNames.indexOf('中文.txt')).toBeGreaterThan(-1)
        done()
      }).catch(error => {
        expect(error).toBe(null)
        done()
      })
    })
  })

  describe('favorite', function () {
    let fileId = 123456789
    let tagId = 6789
    beforeAll(async function (done) {
      const promises = []
      promises.push(setGeneralInteractions(provider))

      let favoriteValues = [true, false]
      for (const value of favoriteValues) {
        promises.push(provider.addInteraction({
          uponReceiving: 'Favorite a file',
          withRequest: {
            method: 'PROPPATCH',
            path: Pact.Matchers.regex({
              matcher: `.*\\/remote\\.php\\/webdav\\/${config.testFile}`,
              generate: `/remote.php/webdav/${config.testFile}`
            }),
            headers: validAuthHeaders,
            body: '<?xml version="1.0"?>\n' +
              '<d:propertyupdate  xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">\n' +
              '  <d:set>\n' +
              '   <d:prop>\n' +
              `      <oc:favorite>${value}</oc:favorite>\n` +
              '    </d:prop>\n' +
              '  </d:set>\n' +
              '</d:propertyupdate>'
          },
          willRespondWith: {
            status: 207,
            headers: {
              ...applicationXmlResponseHeaders,
              'Access-Control-Allow-Headers': accessControlAllowHeaders,
              'Access-Control-Allow-Methods': accessControlAllowMethods
            },
            body: '<?xml version="1.0"?>\n' +
              '<d:multistatus\n' +
              '    xmlns:d="DAV:"\n' +
              '    xmlns:s="http://sabredav.org/ns"\n' +
              '    xmlns:oc="http://owncloud.org/ns">\n' +
              '    <d:response>\n' +
              '        <d:href>/core/remote.php/webdav/testFile.txt</d:href>\n' +
              '        <d:propstat>\n' +
              '            <d:prop>\n' +
              '                <oc:favorite/>\n' +
              '            </d:prop>\n' +
              '            <d:status>HTTP/1.1 200 OK</d:status>\n' +
              '        </d:propstat>\n' +
              '    </d:response>\n' +
              '</d:multistatus>'
          }
        }))
      }

      favoriteValues = [1]
      for (const value of favoriteValues) {
        promises.push(provider.addInteraction({
          uponReceiving: 'propfind file info, favorite ' + value,
          withRequest: {
            method: 'PROPFIND',
            path: Pact.Matchers.term({
              matcher: `.*\\/remote\\.php\\/webdav\\/${config.testFile}`,
              generate: `/remote.php/webdav/${config.testFile}`
            }),
            headers: validAuthHeaders,
            body: '<?xml version="1.0"?>\n' +
              '<d:propfind  xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">\n' +
              '  <d:prop>\n' +
              '    <oc:favorite />\n' +
              '  </d:prop>\n' +
              '</d:propfind>'
          },
          willRespondWith: {
            status: 207,
            headers: {
              ...applicationXmlResponseHeaders,
              'Access-Control-Allow-Headers': accessControlAllowHeaders,
              'Access-Control-Allow-Methods': accessControlAllowMethods
            },
            body: '<?xml version="1.0" encoding="UTF-8"?>\n' +
              '<d:multistatus xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns" xmlns:s="http://sabredav.org/ns">\n' +
              '   <d:response>\n' +
              '      <d:href>/core/remote.php/webdav/testFile.txt</d:href>\n' +
              '      <d:propstat>\n' +
              '         <d:prop>\n' +
              `            <oc:favorite>${value}</oc:favorite>\n` +
              '         </d:prop>\n' +
              '         <d:status>HTTP/1.1 200 OK</d:status>\n' +
              '      </d:propstat>\n' +
              '   </d:response>\n' +
              '</d:multistatus>'
          }
        }))
      }
      Promise.all(promises).then(done, done.fail)
    })

    afterAll(function (done) {
      provider.removeInteractions().then(done, done.fail)
    })

    it('checking method: favorite', function (done) {
      oc.files.putFileContents(config.testFile, testContent).then(status => {
        expect(typeof status).toBe('object')
        return oc.files.favorite(config.testFile)
      }).then(status2 => {
        expect(status2).toEqual(true)
        return oc.files.fileInfo(config.testFile, ['{http://owncloud.org/ns}favorite'])
      }).then(fileInfo => {
        expect(fileInfo.getProperty('{http://owncloud.org/ns}favorite')).toEqual('1')
        return oc.files.favorite(config.testFile, false)
      }).then(status2 => {
        expect(status2).toEqual(true)
        return oc.files.fileInfo(config.testFile, ['{http://owncloud.org/ns}favorite'])
      }).then(fileInfo => {
        expect(fileInfo.getProperty('{http://owncloud.org/ns}favorite')).toEqual('1')
        return oc.files.delete(config.testFile)
      }).then(status2 => {
        expect(status2).toEqual(true)
        done()
      }).catch(error => {
        fail(error)
        done()
      })
    })

    // REPORT
    it('checking method: favorite filter', async function (done) {
      // report method is not supported
      await provider.addInteraction({
        uponReceiving: 'get favorite file',
        withRequest: {
          method: 'REPORT',
          path: Pact.Matchers.regex({
            matcher: '.*\\/remote\\.php\\/dav\\/files\\/admin\\/$',
            generate: '/remote.php/dav/files/admin/'
          }),
          headers: validAuthHeaders,
          body: '<?xml version="1.0"?>\n' +
            '<oc:filter-files  xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">\n' +
            '  <d:prop>\n' +
            '    <oc:favorite />\n' +
            '  </d:prop>\n' +
            '<oc:filter-rules>\n' +
            '<oc:favorite>1</oc:favorite>\n' +
            '</oc:filter-rules>\n' +
            '</oc:filter-files>'
        },
        willRespondWith: {
          status: 207,
          headers: {
            ...applicationXmlResponseHeaders,
            'Access-Control-Allow-Headers': accessControlAllowHeaders,
            'Access-Control-Allow-Methods': accessControlAllowMethods
          },
          body: '<?xml version="1.0"?>\n' +
            '<d:multistatus\n' +
            '    xmlns:d="DAV:"\n' +
            '    xmlns:s="http://sabredav.org/ns"\n' +
            '    xmlns:oc="http://owncloud.org/ns">\n' +
            '    <d:response>\n' +
            '        <d:href>/remote.php/dav/files/admin/testFile.txt</d:href>\n' +
            '        <d:propstat>\n' +
            '            <d:prop>\n' +
            '                <oc:favorite>1</oc:favorite>\n' +
            '            </d:prop>\n' +
            '            <d:status>HTTP/1.1 200 OK</d:status>\n' +
            '        </d:propstat>\n' +
            '    </d:response>\n' +
            '</d:multistatus>'
        }
      })

      oc.files.putFileContents(config.testFile, testContent).then(status => {
        expect(typeof status).toBe('object')
        return oc.files.favorite(config.testFile)
      }).then(status2 => {
        expect(status2).toEqual(true)
        return oc.files.getFavoriteFiles(['{http://owncloud.org/ns}favorite'])
      }).then(files => {
        expect(files.length).toEqual(1)
        expect(files[0].getProperty('{http://owncloud.org/ns}favorite')).toEqual('1')
        return oc.files.delete(config.testFile)
      }).then(status2 => {
        expect(status2).toEqual(true)
        done()
      }).catch(error => {
        expect(error).toBe(null)
        done()
      })
    })

    // REPORT method not implemented in pact.io
    it('searches in the instance', async function (done) {
      const davProperties = [
        '{http://owncloud.org/ns}favorite',
        '{DAV:}getcontentlength',
        '{http://owncloud.org/ns}size',
        '{DAV:}getlastmodified',
        '{DAV:}resourcetype'
      ]

      await provider.addInteraction({
        uponReceiving: 'searches in the instance',
        withRequest: {
          method: 'REPORT',
          path: Pact.Matchers.term({
            matcher: '.*\\/remote\\.php\\/dav\\/files\\/admin\\/$',
            generate: '/remote.php/dav/files/admin/'
          }),
          headers: validAuthHeaders,
          body: '<?xml version="1.0"?>\n' +
            '<oc:search-files  xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">\n' +
            '  <d:prop>\n' +
            '    <oc:favorite />\n' +
            '    <d:getcontentlength />\n' +
            '    <oc:size />\n' +
            '    <d:getlastmodified />\n' +
            '    <d:resourcetype />\n' +
            '  </d:prop>\n' +
            '  <oc:search>\n' +
            '    <oc:pattern>abc</oc:pattern>\n' +
            '    <oc:limit>30</oc:limit>\n' +
            '  </oc:search>\n' +
            '</oc:search-files>'
        },
        willRespondWith: {
          status: 207,
          headers: {
            ...applicationXmlResponseHeaders,
            'Access-Control-Allow-Headers': accessControlAllowHeaders,
            'Access-Control-Allow-Methods': accessControlAllowMethods
          },
          body: '<?xml version="1.0"?>\n' +
            '<d:multistatus\n' +
            '    xmlns:d="DAV:"\n' +
            '    xmlns:s="http://sabredav.org/ns"\n' +
            '    xmlns:oc="http://owncloud.org/ns">\n' +
            '    <d:response>\n' +
            '        <d:href>/core/remote.php/dav/files/admin/testFolder/abc.txt</d:href>\n' +
            '        <d:propstat>\n' +
            '            <d:prop>\n' +
            '                <oc:favorite>0</oc:favorite>\n' +
            '                <d:getcontentlength>6</d:getcontentlength>\n' +
            '                <oc:size>6</oc:size>\n' +
            '                <d:getlastmodified>Wed, 21 Oct 2020 11:20:54 GMT</d:getlastmodified>\n' +
            '                <d:resourcetype/>\n' +
            '            </d:prop>\n' +
            '            <d:status>HTTP/1.1 200 OK</d:status>\n' +
            '        </d:propstat>\n' +
            '    </d:response>\n' +
            '</d:multistatus>'
        }
      })

      oc.files.search('abc', 30, davProperties).then(files => {
        expect(typeof (files)).toBe('object')
        expect(files.length).toEqual(1)
        expect(files[0].getName()).toEqual('abc.txt')
        expect(files[0].getPath()).toEqual('/' + config.testFolder + '/')
        expect(files[0].getSize()).toEqual(6)
        done()
      }).catch(error => {
        expect(error).toBe(null)
        done()
      })
    })

    // REPORT is not supported by pact.io
    it('checking method: filter by tag', async function (done) {
      const newFile = config.testFolder + '/' + config.testFile
      const newTagName = 'testSystemTag12345'

      await provider.addInteraction({
        uponReceiving: 'create Tag',
        withRequest: {
          method: 'POST',
          path: Pact.Matchers.term({
            matcher: '.*\\/remote\\.php\\/dav\\/systemtags',
            generate: '/remote.php/dav/systemtags'
          }),
          headers: {
            ...validAuthHeaders,
            'Content-Type': 'application/json'
          },
          body: { canAssign: true, name: newTagName, userAssignable: true, userEditable: true, userVisible: true }
        },
        willRespondWith: {
          status: 201,
          headers: {
            ...applicationXmlResponseHeaders,
            'Access-Control-Allow-Headers': accessControlAllowHeaders,
            'Access-Control-Allow-Methods': accessControlAllowMethods,
            'Access-Control-Expose-Headers': 'Content-Location,DAV,ETag,Link,Lock-Token,OC-ETag,OC-Checksum,OC-FileId,OC-JobStatus-Location,Vary,Webdav-Location,X-Sabre-Status',
            'Content-Location': `/remote.php/dav/systemtags/${tagId}`
          }
        }
      })

      await provider.addInteraction({
        uponReceiving: 'PROPFIND file info, fileId',
        withRequest: {
          method: 'PROPFIND',
          path: Pact.Matchers.term({
            matcher: `.*\\/remote\\.php\\/webdav\\/${config.testFolder}\\/${config.testFile}`,
            generate: `/remote.php/webdav/${config.testFolder}/${config.testFile}`
          }),
          headers: validAuthHeaders,
          body: '<?xml version="1.0"?>\n' +
            '<d:propfind  xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">\n' +
            '  <d:prop>\n' +
            '    <oc:fileid />\n' +
            '  </d:prop>\n' +
            '</d:propfind>'
        },
        willRespondWith: {
          status: 207,
          headers: {
            ...applicationXmlResponseHeaders,
            'Access-Control-Allow-Headers': accessControlAllowHeaders,
            'Access-Control-Allow-Methods': accessControlAllowMethods
          },
          body: '<?xml version="1.0"?>\n' +
            '<d:multistatus\n' +
            '    xmlns:d="DAV:"\n' +
            '    xmlns:s="http://sabredav.org/ns"\n' +
            '    xmlns:oc="http://owncloud.org/ns">\n' +
            '    <d:response>\n' +
            `        <d:href>/remote.php/webdav/${config.testFolder}/${config.testFile}</d:href>\n` +
            '        <d:propstat>\n' +
            '            <d:prop>\n' +
            `                <oc:fileid>${fileId}</oc:fileid>\n` +
            '            </d:prop>\n' +
            '            <d:status>HTTP/1.1 200 OK</d:status>\n' +
            '        </d:propstat>\n' +
            '    </d:response>\n' +
            '</d:multistatus>'
        }
      })

      await provider.addInteraction({
        uponReceiving: 'tag file',
        withRequest: {
          method: 'PUT',
          path: Pact.Matchers.term({
            matcher: `.*\\/remote\\.php\\/dav\\/systemtags-relations\\/files\\/${fileId}\\/${tagId}`,
            generate: `/remote.php/dav/systemtags-relations/files/${fileId}/${tagId}`
          }),
          headers: validAuthHeaders
        },
        willRespondWith: {
          status: 201,
          headers: {
            ...applicationXmlResponseHeaders,
            'Access-Control-Allow-Headers': accessControlAllowHeaders,
            'Access-Control-Allow-Methods': accessControlAllowMethods
          }
        }
      })

      await provider.addInteraction({
        uponReceiving: 'get files by tag',
        withRequest: {
          method: 'REPORT',
          path: Pact.Matchers.regex({
            matcher: '.*\\/remote\\.php\\/dav\\/files\\/admin\\/$',
            generate: '/remote.php/dav/files/admin/'
          }),
          headers: validAuthHeaders,
          body: '<?xml version="1.0"?>\n' +
            '<oc:filter-files  xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">\n' +
            '  <d:prop>\n' +
            '    <oc:fileid />\n' +
            '  </d:prop>\n' +
            `<oc:filter-rules><oc:systemtag>${tagId}</oc:systemtag></oc:filter-rules></oc:filter-files>`
        },
        willRespondWith: {
          status: 207,
          headers: {
            ...applicationXmlResponseHeaders,
            'Access-Control-Allow-Headers': accessControlAllowHeaders,
            'Access-Control-Allow-Methods': accessControlAllowMethods
          },
          body: '<?xml version="1.0"?>\n' +
            '<d:multistatus\n' +
            '    xmlns:d="DAV:"\n' +
            '    xmlns:s="http://sabredav.org/ns"\n' +
            '    xmlns:oc="http://owncloud.org/ns">\n' +
            '    <d:response>\n' +
            `        <d:href>/core/remote.php/dav/files/admin/${config.testFolder}/${config.testFile}</d:href>\n` +
            '        <d:propstat>\n' +
            '            <d:prop>\n' +
            `                <oc:fileid>${fileId}</oc:fileid>\n` +
            '            </d:prop>\n' +
            '            <d:status>HTTP/1.1 200 OK</d:status>\n' +
            '        </d:propstat>\n' +
            '    </d:response>\n' +
            '</d:multistatus>'
        }
      })

      oc.files.putFileContents(newFile, testContent).then(status => {
        expect(typeof status).toBe('object')
        return oc.files.fileInfo(newFile, ['{http://owncloud.org/ns}fileid'])
      }).then(fileInfo => {
        fileId = fileInfo.getFileId()
        return oc.systemTags.createTag({ name: newTagName })
      }).then(resp => {
        tagId = resp
        return oc.systemTags.tagFile(fileId, tagId)
      }).then(() => {
        return oc.files.getFilesByTags([tagId], ['{http://owncloud.org/ns}fileid'])
      }).then(files => {
        expect(files.length).toEqual(1)
        expect(files[0].getName()).toEqual(config.testFile)
        done()
      }).catch(error => {
        expect(error).toBe(null)
        done()
      })
    })
  })
})
