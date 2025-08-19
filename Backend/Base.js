const { google } = require('googleapis')
const path = require('path')
const fs = require('fs')
require('dotenv').config()

const CLIENT_ID= process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET
const REDIRECT_URI = process.env.REDIRECT_URI
const REFRESH_TOKEN = process.env.REFRESH_TOKEN

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
)

oauth2Client.setCredentials({
    refresh_token: REFRESH_TOKEN
})

const drive = google.drive({
    version: 'v3',
    auth: oauth2Client
})

const filePath = path.join(__dirname, 'girl.jpeg')

async function uploadFile() {
    const fileMetadata = {
        name: 'test-image.jpg',
        mimeType: 'image/jpeg'
    }
    const media = {
        mimeType: 'image/jpeg',
        body: fs.createReadStream(filePath)
    }   
    try {
        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id'
        })
        console.log('File ID:', response.data.id)
    } catch (error) {
        console.error('Error uploading file:', error.message)
    }
}


async function listFiles() {
    try {
        const response = await drive.files.list({
            pageSize: 10,
            fields: 'nextPageToken, files(id, name)'
        })
        const files = response.data.files
        if (files.length) {
            console.log('Files:')
            files.forEach(file => {
                console.log(`${file.name} (${file.id})`)
            })
        } else {
            console.log('No files found.')
        }
    } catch (error) {
        console.error('Error listing files:', error.message)
    }
}


async function deleteFile(fileId) {
    try {
        await drive.files.delete({
            fileId: fileId
        })
        console.log(`File with ID ${fileId} deleted successfully.`)
    } catch (error) {
        console.error('Error deleting file:', error.message)
    }
}

deleteFile('1UE8AP58gRMjGWLWWpB6LZRqXnsFWOfw-') // Replace with the actual file ID you want to delete

//uploadFile();


//listFiles();