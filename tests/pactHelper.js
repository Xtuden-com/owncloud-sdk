var config = require('./config/config.json')
var validUserPasswordHash = btoa(config.username + ':' + config.password)
const Pact = require('@pact-foundation/pact-web')

const accessControlAllowHeaders = 'OC-Checksum,OC-Total-Length,OCS-APIREQUEST,X-OC-Mtime,Accept,Authorization,Brief,Content-Length,Content-Range,Content-Type,Date,Depth,Destination,Host,If,If-Match,If-Modified-Since,If-None-Match,If-Range,If-Unmodified-Since,Location,Lock-Token,Overwrite,Prefer,Range,Schedule-Reply,Timeout,User-Agent,X-Expected-Entity-Length,Accept-Language,Access-Control-Request-Method,Access-Control-Allow-Origin,ETag,OC-Autorename,OC-CalDav-Import,OC-Chunked,OC-Etag,OC-FileId,OC-LazyOps,OC-Total-File-Length,Origin,X-Request-ID,X-Requested-With'
const accessControlAllowMethods = 'GET,OPTIONS,POST,PUT,DELETE,MKCOL,PROPFIND,PATCH,PROPPATCH,REPORT,HEAD,COPY,MOVE,LOCK,UNLOCK'
const origin = 'http://localhost:9876'
const validAuthHeaders = {
  authorization: 'Basic ' + validUserPasswordHash,
  Origin: origin
}

const testSubFiles = [
  config.testFolder + '/' + 'file%20one.txt',
  config.testFolder + '/' + 'zz%2Bz.txt',
  config.testFolder + '/' + '中文.txt',
  config.testFolder + '/' + 'abc.txt',
  config.testFolder + '/' + 'subdir/in%20dir.txt',
  config.testFolder + '/' + '%E4%B8%AD%E6%96%87.txt'
]

const ocsMeta = function (status, statusCode, Message = null) {
  if (Message == null) {
    return ' <meta>\n' +
      '  <status>' + status + '</status>\n' +
      '  <statuscode>' + statusCode + '</statuscode>\n' +
      '  <message/>\n' +
      ' </meta>\n'
  }
  return ' <meta>\n' +
    '  <status>' + status + '</status>\n' +
    '  <statuscode>' + statusCode + '</statuscode>\n' +
    '  <message>' + Message + '</message>\n' +
    ' </meta>\n'
}

const shareResponseOcsData = function (shareType, id, permissions, fileTarget) {
  const data = '  <id>' + id + '</id>\n' +
    '  <share_type>' + shareType + '</share_type>\n' +
    '  <uid_owner>admin</uid_owner>\n' +
    '  <displayname_owner>admin</displayname_owner>\n' +
    '  <permissions>' + permissions + '</permissions>\n' +
    '  <uid_file_owner>admin</uid_file_owner>\n' +
    '  <displayname_file_owner>admin</displayname_file_owner>\n' +
    '  <path>' + fileTarget + '</path>\n' +
    '  <file_target>' + fileTarget + '</file_target>\n'

  if (shareType === 3) {
    return data +
      '  <url>' + config.owncloudURL + '/s/yrkoLeS33y1aTya</url>\n'
  }
  return data
}

const applicationXmlResponseHeaders = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Access-Control-Allow-Origin': origin
}

const xmlResponseHeaders = {
  'Content-Type': 'text/xml; charset=utf-8',
  'Access-Control-Allow-Origin': origin
}

const invalidAuthHeader = Pact.Matchers.term({
  matcher: '^(?!Basic ' + validUserPasswordHash + ').*$', // match anything except a valid auth
  generate: 'Basic bm9uRXhpc3RpbmdVc2VycnByeXJxOHg2OmNvbmZpZy5wYXNzd29yZHJwcnlycTh4Ng=='
})

const unauthorizedXmlResponseBody = '<?xml version="1.0"?>\n' +
  '<ocs>\n' +
  ' <meta>\n' +
  '  <status>failure</status>\n' +
  '  <statuscode>997</statuscode>\n' +
  '  <message>Unauthorised</message>\n' +
  ' </meta>\n' +
  ' <data/>\n' +
  '</ocs>'

const webdavMatcherForResource = resource => {
  if (resource.includes('/')) {
    return resource.replace('/', '\\/') + '$'
  } else {
    return resource
  }
}
const getContentsOfFile = file => {
  return {
    uponReceiving: 'GET contents of file ' + file,
    withRequest: {
      method: 'GET',
      path: Pact.Matchers.regex({
        matcher: '.*\\/remote\\.php\\/webdav\\/' + webdavMatcherForResource(file),
        generate: `/remote.php/webdav/${file}`
      }),
      headers: validAuthHeaders
    },
    willRespondWith: file !== config.nonExistentFile ? {
      status: 200,
      headers: {
        ...applicationXmlResponseHeaders,
        'Access-Control-Allow-Headers': accessControlAllowHeaders,
        'Access-Control-Allow-Methods': accessControlAllowMethods
      },
      body: config.testContent
    } : {
      status: 404,
      headers: {
        ...applicationXmlResponseHeaders,
        'Access-Control-Allow-Headers': accessControlAllowHeaders,
        'Access-Control-Allow-Methods': accessControlAllowMethods
      },
      body: '<?xml version="1.0" encoding="utf-8"?>\n' +
        '<d:error xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns">\n' +
        '  <s:exception>Sabre\\DAV\\Exception\\NotFound</s:exception>\n' +
        `  <s:message>File with name ${config.nonExistentFile} could not be located</s:message>\n` +
        '</d:error>'
    }
  }
}

const deleteResource = resource => {
  return {
    uponReceiving: 'a request to delete a folder, ' + resource,
    withRequest: {
      method: 'DELETE',
      path: Pact.Matchers.term({
        matcher: '.*\\/remote\\.php\\/webdav\\/' + webdavMatcherForResource(resource),
        generate: '/remote.php/webdav/' + resource
      }),
      headers: validAuthHeaders
    },
    willRespondWith: resource.includes('nonExistent') ? {
      status: 404,
      headers: {
        ...applicationXmlResponseHeaders,
        'Access-Control-Allow-Headers': accessControlAllowHeaders,
        'Access-Control-Allow-Methods': accessControlAllowMethods
      },
      body: '<?xml version="1.0" encoding="utf-8"?>\n' +
        '<d:error xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns">\n' +
        '  <s:exception>Sabre\\DAV\\Exception\\NotFound</s:exception>\n' +
        '  <s:message>File with name nonExistentDir could not be located</s:message>\n' +
        '</d:error>'
    } : {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin
      }
    }
  }
}

function setGeneralInteractions (provider) {
  const promises = []

  promises.push(provider.addInteraction({
    uponReceiving: 'any CORS preflight request',
    withRequest: {
      method: 'OPTIONS',
      path: Pact.Matchers.regex({
        matcher: '.*',
        generate: '/ocs/v1.php/cloud/capabilities'
      }),
      headers: {
        'Access-Control-Request-Method': Pact.Matchers.regex({
          matcher: 'GET|POST|PUT|DELETE|MKCOL|PROPFIND|MOVE|COPY|REPORT',
          generate: 'GET'
        })
      }
    },
    willRespondWith: {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': accessControlAllowHeaders,
        'Access-Control-Allow-Methods': accessControlAllowMethods
      }
    }
  }))
  promises.push(provider.addInteraction({
    uponReceiving: 'a capabilities GET request with valid authentication',
    withRequest: {
      method: 'GET',
      path: Pact.Matchers.regex({
        matcher: '.*\\/ocs\\/v(1|2)\\.php\\/cloud\\/capabilities',
        generate: '/ocs/v1.php/cloud/capabilities'
      }),
      query: 'format=json',
      headers: validAuthHeaders
    },
    willRespondWith: {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': origin
      },
      body: {
        ocs: {
          meta: {
            status: 'ok',
            statuscode: 100,
            message: 'OK'
          },
          data: {
            version: Pact.Matchers.like({
              major: 10,
              minor: 5,
              micro: 1,
              string: '10.5.1alpha1',
              edition: 'Enterprise'
            }),
            capabilities: {
              files: {
                privateLinks: true,
                privateLinksDetailsParam: true,
                bigfilechunking: true,
                blacklisted_files: [
                  '.htaccess'
                ],
                favorites: true,
                file_locking_support: true,
                file_locking_enable_file_action: false,
                undelete: true,
                versioning: true
              },
              dav: {
                trashbin: '1.0'
              }
            }
          }
        }
      }
    }
  }))
  promises.push(provider.addInteraction({
    uponReceiving: 'a capabilities GET request with invalid authentication',
    withRequest: {
      method: 'GET',
      path: Pact.Matchers.term({
        matcher: '.*\\/ocs\\/v(1|2)\\.php\\/cloud\\/capabilities',
        generate: '/ocs/v1.php/cloud/capabilities'
      }),
      query: 'format=json',
      headers: {
        authorization: invalidAuthHeader,
        Origin: origin
      }
    },
    willRespondWith: {
      status: 401,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': origin
      },
      body: {
        ocs: {
          meta: {
            status: 'failure',
            statuscode: 997,
            message: 'Unauthorised'
          }
        }
      }
    }
  }))
  promises.push(provider.addInteraction({
    uponReceiving: 'a GET request to the cloud user endpoint',
    withRequest: {
      method: 'GET',
      path: Pact.Matchers.term({
        matcher: '.*\\/ocs\\/v(1|2)\\.php\\/cloud\\/user$',
        generate: '/ocs/v1.php/cloud/user'
      }),
      headers: validAuthHeaders
    },
    willRespondWith: {
      status: 200,
      headers: applicationXmlResponseHeaders,
      body: Pact.Matchers.term({
        matcher: '<\\?xml version="1\\.0"\\?>\\s' +
          '<ocs>\\s' +
          ocsMeta('ok', 100, 'OK') +
          ' <data>\\s' +
          '  <id>admin<\\/id>\\s' +
          '  <display-name>admin<\\/display-name>\\s' +
          '  <email><\\/email>\\s.*' +
          ' <\\/data>\\s' +
          '<\\/ocs>',
        generate: '<?xml version="1.0"?>\n' +
          '<ocs>\n' +
          ocsMeta('ok', 100, 'OK') +
          ' <data>\n' +
          '  <id>admin</id>\n' +
          '  <display-name>admin</display-name>\n' +
          '  <email></email>\n' +
          ' </data>\n' +
          '</ocs>'
      })
    }
  }))
  promises.push(provider.addInteraction({
    uponReceiving: 'a single user GET request to the cloud users endpoint',
    withRequest: {
      method: 'GET',
      path: Pact.Matchers.term({
        matcher: '.*\\/ocs\\/v2\\.php\\/cloud\\/users\\/.+',
        generate: '/ocs/v2.php/cloud/users/' + config.testUser
      }),
      query: 'format=json',
      headers: validAuthHeaders
    },
    willRespondWith: {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': origin
      },
      body: {
        ocs: {
          meta: {
            status: 'ok',
            statuscode: 200,
            message: null
          },
          data: {
            email: 'foo@bar.net'
          }
        }
      }
    }
  }))
  promises.push(provider.addInteraction({
    uponReceiving: 'a create user request',
    withRequest: {
      method: 'POST',
      path: Pact.Matchers.regex({
        matcher: '.*\\/ocs\\/v(1|2)\\.php\\/cloud\\/users',
        generate: '/ocs/v1.php/cloud/users'
      }),
      headers: validAuthHeaders,
      body: 'password=' + config.testUser + '&userid=' + config.testUser
    },
    willRespondWith: {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin
      }
    }
  }))
  promises.push(provider.addInteraction({
    uponReceiving: 'a create user request including group membership',
    withRequest: {
      method: 'POST',
      path: Pact.Matchers.term({
        matcher: '.*\\/ocs\\/v1\\.php\\/cloud\\/users',
        generate: '/ocs/v1.php/cloud/users'
      }),
      headers: validAuthHeaders,
      body: 'password=' + config.testUserPassword + '&userid=' + config.testUser + '&groups%5B0%5D=' + config.testGroup
    },
    willRespondWith: {
      status: 200,
      headers: xmlResponseHeaders,
      body: '<?xml version="1.0"?>\n' +
        '<ocs>\n' +
        ocsMeta('ok', '100') +
        '  <data/>\n' +
        '</ocs>\n'
    }
  }))

  promises.push(provider.addInteraction({
    uponReceiving: 'a request to delete a user',
    withRequest: {
      method: 'DELETE',
      path: Pact.Matchers.term({
        matcher: '.*\\/ocs\\/v1\\.php\\/cloud\\/users\\/' + config.testUser + '$',
        generate: '/ocs/v1.php/cloud/users/' + config.testUser
      }),
      headers: validAuthHeaders
    },
    willRespondWith: {
      status: 200,
      headers: xmlResponseHeaders,
      body: '<?xml version="1.0"?>\n' +
        '<ocs>\n' +
        ocsMeta('ok', '100') +
        '  <data/>\n' +
        '</ocs>\n'
    }
  }))
  promises.push(provider.addInteraction({
    uponReceiving: 'a create group POST request',
    withRequest: {
      method: 'POST',
      path: Pact.Matchers.term({
        matcher: '.*\\/ocs\\/v1\\.php\\/cloud\\/groups$',
        generate: '/ocs/v1.php/cloud/groups'
      }),
      headers: validAuthHeaders,
      body: 'groupid=' + config.testGroup
    },
    willRespondWith: {
      status: 200,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Access-Control-Allow-Origin': origin
      },
      body: '<?xml version="1.0"?>\n' +
        '<ocs>\n' +
        ocsMeta('ok', '100') +
        ' <data/>\n' +
        '</ocs>'
    }
  }))
  promises.push(provider.addInteraction({
    uponReceiving: 'a user DELETE request',
    withRequest: {
      method: 'DELETE',
      path: Pact.Matchers.term({
        matcher: '.*\\/ocs\\/v1\\.php\\/cloud\\/users/' + config.testUser + '$',
        generate: '/ocs/v1.php/cloud/users/' + config.testUser
      }),
      headers: {
        authorization: validAuthHeaders,
        Origin: origin
      },
      body: 'undefined=undefined'
    },
    willRespondWith: {
      status: 200,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Access-Control-Allow-Origin': origin
      },
      body: '<?xml version="1.0"?>\n' +
        '<ocs>\n' +
        ocsMeta('ok', '100') +
        ' <data/>\n' +
        '</ocs>'
    }
  }))
  promises.push(provider.addInteraction({
    uponReceiving: 'a group DELETE request',
    withRequest: {
      method: 'DELETE',
      path: Pact.Matchers.term({
        matcher: '.*\\/ocs\\/v1\\.php\\/cloud\\/groups/' + config.testGroup + '$',
        generate: '/ocs/v1.php/cloud/groups/' + config.testGroup
      }),
      headers: validAuthHeaders,
      body: 'undefined=undefined'
    },
    willRespondWith: {
      status: 200,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Access-Control-Allow-Origin': origin
      },
      body: '<?xml version="1.0"?>\n' +
        '<ocs>\n' +
        ocsMeta('ok', '100') +
        ' <data/>\n' +
        '</ocs>'
    }
  }))

  promises.push(provider.addInteraction({
    uponReceiving: 'successfully create a folder',
    withRequest: {
      method: 'MKCOL',
      path: Pact.Matchers.term({
        // accept any request to testfolder and any subfolders except notExistentDir
        matcher: '.*\\/remote\\.php\\/webdav\\/' + config.testFolder + '\\/(?!' + config.nonExistentDir + ').*\\/?',
        generate: '/remote.php/webdav/' + config.testFolder + '/'
      }),
      headers: validAuthHeaders
    },
    willRespondWith: {
      status: 201,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': accessControlAllowHeaders,
        'Access-Control-Allow-Methods': accessControlAllowMethods
      }
    }
  }))

  // const filesArray = [...testSubFiles, config.testFile, config.testFolder + '/' + config.testFile, config.nonExistentFile]
  // for (const file of filesArray) {
  //   promises.push(provider.addInteraction({
  //     uponReceiving: 'GET file contents',
  //     withRequest: {
  //       method: 'GET',
  //       path: Pact.Matchers.regex({
  //         matcher: '.*\\/remote\\.php\\/webdav\\/' + file.includes('/') ? file.replace(/, \\/) : file + '$',
  //         generate: `/remote.php/webdav/${file}`
  //       }),
  //       headers: validAuthHeaders
  //     },
  //     willRespondWith: file !== config.nonExistentFile ? {
  //       status: 200,
  //       headers: {
  //         ...applicationXmlResponseHeaders,
  //         'Access-Control-Allow-Headers': accessControlAllowHeaders,
  //         'Access-Control-Allow-Methods': accessControlAllowMethods
  //       },
  //       body: config.testContent
  //     } : {
  //       status: 404,
  //       headers: {
  //         ...applicationXmlResponseHeaders,
  //         'Access-Control-Allow-Headers': accessControlAllowHeaders,
  //         'Access-Control-Allow-Methods': accessControlAllowMethods
  //       },
  //       body: '<?xml version="1.0" encoding="utf-8"?>\n' +
  //         '<d:error xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns">\n' +
  //         '  <s:exception>Sabre\\DAV\\Exception\\NotFound</s:exception>\n' +
  //         '  <s:message>File with name nonExistentFile could not be located</s:message>\n' +
  //         '</d:error>'
  //     }
  //   }))
  // }

  let files = ['test.txt', '%E6%96%87%E4%BB%B6.txt', 'test%20space%20and%20%2B%20and%20%23.txt', 'newFileCreated123', config.testFile]
  for (const file of files) {
    promises.push(provider.addInteraction({
      uponReceiving: 'a DELETE request for a file ' + file,
      withRequest: {
        method: 'DELETE',
        path: Pact.Matchers.term({
          matcher: '.*\\/remote\\.php\\/webdav\\/' + file + '$',
          generate: '/remote.php/webdav/' + file
        }),
        headers: validAuthHeaders
      },
      willRespondWith: {
        status: 200,
        headers: xmlResponseHeaders,
        body: '<?xml version="1.0"?>\n' +
          '<ocs>\n' +
          ocsMeta('ok', '100') +
          ' <data/>\n' +
          '</ocs>'
      }
    }))
  }

  files = [
    'test.txt', '%E6%96%87%E4%BB%B6.txt', 'test%20space%20and%20%2B%20and%20%23.txt',
    config.testFile, config.testFolder + '/' + config.testFile,
    ...testSubFiles, config.testFolder + '/fileToTag.txt',
    config.nonExistentDir + '/file.txt'
  ]
  for (const file of files) {
    promises.push(provider.addInteraction({
      uponReceiving: 'Put file contents to file ' + file,
      withRequest: {
        method: 'PUT',
        path: Pact.Matchers.regex({
          matcher: '.*\\/remote\\.php\\/webdav\\/' + webdavMatcherForResource(file),
          generate: '/remote.php/webdav/' + file
        }),
        headers: validAuthHeaders,
        body: config.testContent
      },
      willRespondWith: file.includes('nonExistent') ? {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': origin
        },
        body: '<?xml version="1.0" encoding="utf-8"?>\n' +
          '<d:error xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns">\n' +
          '  <s:exception>Sabre\\DAV\\Exception\\NotFound</s:exception>\n' +
          '  <s:message>File with name nonExistentDir could not be located</s:message>\n' +
          '</d:error>'
      } : {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': origin
        }
      }
    }))
  }

  // const resources = [config.testFolder, config.testFolder + '/' + 'new%20folder', config.testFolder + '/' + config.testFile, config.nonExistentDir]
  // for (const folder of resources) {
  //   promises.push(provider.addInteraction({
  //     uponReceiving: 'a request to delete a folder, ' + folder,
  //     withRequest: {
  //       method: 'DELETE',
  //       path: Pact.Matchers.term({
  //         matcher: '.*\\/remote\\.php\\/webdav\\/' + webdavMatcherForResource(folder),
  //         generate: '/remote.php/webdav/' + folder
  //       }),
  //       headers: validAuthHeaders
  //     },
  //     willRespondWith: folder.includes('nonExistent') ? {
  //       status: 404,
  //       headers: {
  //         ...applicationXmlResponseHeaders,
  //         'Access-Control-Allow-Headers': accessControlAllowHeaders,
  //         'Access-Control-Allow-Methods': accessControlAllowMethods
  //       },
  //       body: '<?xml version="1.0" encoding="utf-8"?>\n' +
  //         '<d:error xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns">\n' +
  //         '  <s:exception>Sabre\\DAV\\Exception\\NotFound</s:exception>\n' +
  //         '  <s:message>File with name nonExistentDir could not be located</s:message>\n' +
  //         '</d:error>'
  //     } : {
  //       status: 204,
  //       headers: {
  //         'Access-Control-Allow-Origin': origin
  //       }
  //     }
  //   }))
  // }
  return promises
}

module.exports = {
  setGeneralInteractions,
  getContentsOfFile,
  deleteResource,
  ocsMeta,
  shareResponseOcsData,
  origin,
  validAuthHeaders,
  invalidAuthHeader,
  xmlResponseHeaders,
  applicationXmlResponseHeaders,
  accessControlAllowHeaders,
  accessControlAllowMethods,
  unauthorizedXmlResponseBody
}
