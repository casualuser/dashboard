import path from 'path'
import fs from 'fs'
import atomicWriteFileSync from '../electron/atomicWriteFile'

const DEBUG = false

/*
 * Returns object of AWS profiles
 * This originally has been copied from
 * https://github.com/aws/aws-sdk-js/blob/master/lib/util.js#L176-L195
 */
export const getAWSCredentials = () => {
  const fileContents = getAWSCredentialsFile()
  const profiles = {}
  if (!fileContents) {
    return profiles
  }
  const lines = fileContents.split(/\r?\n/)
  let currentSection
  lines.forEach((line) => {
    const lineData = removeCommentsFromString(line)
    const section = lineData.match(/^\s*\[([^[\]]+)]\s*$/)
    if (section) {
      currentSection = section[1]
    } else if (currentSection) {
      const item = lineData.match(/^\s*(.+?)\s*=\s*(.+?)\s*$/)
      if (item) {
        profiles[currentSection] = profiles[currentSection] || {}
        profiles[currentSection][item[1]] = item[2]
      }
    }
  })
  return profiles
}

export function createAWSProfile({ profile, aws_access_key_id, aws_secret_access_key }) {
  const profileData = getAWSProfileData(profile)
  if (profileData) {
    // Profile Already Exists! Return error
    return false
  }
  if (profile && aws_access_key_id && aws_secret_access_key) { // eslint-disable-line
    return appendAwsCredentials({
      profile,
      awsAccessKeyId: aws_access_key_id,
      awsSecretAccessKey: aws_secret_access_key
    })
  }
  // missing values return error
  return false
}

export function updateAWSProfile(profileName, newValues) {
  const filePath = getAWSCredentialsPath()
  let creds = getAWSCredentialsFile()
  const currentCredsData = getAWSProfileData(profileName)
  if (currentCredsData) {
    const {
      accessKey,
      accessKeyRawText,
      secretAccessKey,
      secretAccessKeyRawText
    } = currentCredsData
    const key = newValues.aws_access_key_id
    const secret = newValues.aws_secret_access_key

    // if key is new, replace the old one
    if (key && key !== accessKey) {
      creds = creds.replace(accessKeyRawText, `aws_access_key_id=${key}`)
    }
    // if secret is new, replace the old one
    if (secret && secret !== secretAccessKey) {
      creds = creds.replace(secretAccessKeyRawText, `aws_secret_access_key=${secret}`)
    }
    atomicWriteFileSync(filePath, creds)
    return getAWSCredentials()
  }
  // no profile matches return false
  return false
}

export function deleteAWSProfile(profileName) {
  const filePath = getAWSCredentialsPath()
  const fileContents = getAWSCredentialsFile()
  const profileData = getAWSProfileData(profileName)
  if (profileData) {
    const newContent = fileContents.replace(profileData.rawText, '')
    atomicWriteFileSync(filePath, newContent)
    return getAWSCredentials()
  }
  // no profile matches return false
  return false
}

export function getAWSProfileData(profileName) {
  const awsCredentialsFile = getAWSCredentialsFile()
  /* pattern /^\s*\[default((.|\n)*?.*^(\[|\s)/gm */
  const pattern = new RegExp(`^\s*\\[${profileName}((.|\\n)*?.*^(\\[|\\s))`, "gm") // eslint-disable-line
  const creds = awsCredentialsFile.match(pattern)
  if (creds) {
    const accessKey = getAccessKey(creds[0])
    const secretKey = getSecretAccessKey(creds[0])
    if (DEBUG) {
      // eslint-disable-next-line
      console.log('creds match', creds)
      // eslint-disable-next-line
      console.log('accessKey string', accessKey[0])
      // eslint-disable-next-line
      console.log('secretKey string', secretKey[0])
    }

    if (!accessKey || !secretKey) {
      // might need to throw error here
      return false
    }

    return {
      rawText: creds[0].slice(0, -1), // remove trailing [
      accessKey: accessKey[1], // value
      accessKeyRawText: accessKey[0], // for easy find/replace
      secretAccessKey: secretKey[1], // value
      secretAccessKeyRawText: secretKey[0] // for easy find/replace
    }
  }
  // Single or last value in the file. regex above doesnt match ending or single profiles
  const singlePattern = new RegExp(`^\s*\\[${profileName}(.|\\n)*`, "gm") // eslint-disable-line
  const singleCreds = awsCredentialsFile.match(singlePattern)
  // console.log(singleCreds)
  if (singleCreds) {
    const accessKey = getAccessKey(singleCreds[0])
    const secretKey = getSecretAccessKey(singleCreds[0])
    if (!accessKey || !secretKey) {
      return false
    }
    if (DEBUG) {
      // eslint-disable-next-line
      console.log('accessKey string', accessKey[0])
      // eslint-disable-next-line
      console.log('secretKey string', secretKey[0])
    }
    // do replacements
    return {
      rawText: singleCreds[0], // for easy find/replace
      accessKey: accessKey[1], // value
      accessKeyRawText: accessKey[0], // for easy find/replace
      secretAccessKey: secretKey[1], // value
      secretAccessKeyRawText: secretKey[0] // for easy find/replace
    }
  }

  return false
}

function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath)
  if (fs.existsSync(dirname)) {
    return true
  }
  ensureDirectoryExistence(dirname)
  fs.mkdirSync(dirname)
}

export const appendAwsCredentials = ({ profile, awsAccessKeyId, awsSecretAccessKey }) => {
  const credentialsPath = getAWSCredentialsPath()
  // ensure that .aws folder exists
  ensureDirectoryExistence(credentialsPath)

  try {
    const content = [
      `[${profile}]\n`,
      `aws_access_key_id=${awsAccessKeyId}\n`,
      `aws_secret_access_key=${awsSecretAccessKey}\n\n`
    ].join('')
    fs.appendFileSync(credentialsPath, content)
    return getAWSCredentials()
  } catch (err) {
    console.log(err)
    return {}
  }
}

/*
  Returns string of path to aws file
*/
export const getAWSCredentialsPath = () => {
  const { env } = process
  const home = env.HOME || env.USERPROFILE || (env.HOMEPATH ? ((env.HOMEDRIVE || 'C:/') + env.HOMEPATH) : null)
  if (!home) {
    throw new Error('Can\'t find home directory on your local file system.')
  }
  return path.join(home, '.aws', 'credentials')
}

/*
  Returns string of contents of aws crendentials file
*/
export const getAWSCredentialsFile = () => {
  const credentialsPath = getAWSCredentialsPath()
  try {
    return fs.readFileSync(credentialsPath).toString()
  } catch (err) {
    return false
  }
}

/*
  Returns array
*/
function getAccessKey(text) {
  return text.match(/^aws_access_key_id=([a-zA-Z0-9\S]*)/m)
}
/*
  Returns array
*/
function getSecretAccessKey(text) {
  return text.match(/^aws_secret_access_key=([a-zA-Z0-9\S]*)/m)
}
/*
  Returns string minus comments
*/
function removeCommentsFromString(text) {
  return (text) ? text.split(/(^|\s)[;#]/)[0] : ''
}
