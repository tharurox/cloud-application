Assignment 1 - Web Server - Response to Criteria
================================================

Overview
------------------------------------------------

- **Name:** Thraka Ranathunga
- **Student number:** N11849622
- **Application name:** Video Transcriber
- **Two line description:** Can convert Video into text via an uploaded file or by specifiying 
an external URL to the video. Users can download the converted text as a text file.


Core criteria
------------------------------------------------

### Docker image

- **ECR Repository name:** 11849622
- **Video timestamp:** 
- **Relevant files:**
    - /Dockerfile

### Docker image running on EC2

- **EC2 instance ID:** i-000013ca160b17fb8
- **Video timestamp:**

### User login functionality

- **One line description:**
- **Video timestamp:** 
- **Relevant files:**
    - /views/login.ejs
    - /app.js (line 156)

### User dependent functionality

- **One line description:** Files are owned by a created user.  Users can only list, view and download their own files.
- **Video timestamp:** 
- **Relevant files:**
    - /app.js (line 289)
    - /config/database.js (line 15)

### Web client

- **One line description:**
- **Video timestamp:**
- **Relevant files:**
    - /views/index.ejs
    - /app.js (line 107)

### REST API

- **One line description:**
- **Video timestamp:** 
- **Relevant files:**
    - 

### Two kinds of data

#### First kind

- **One line description:**
- **Type:** Unstructured
- **Rationale:**  Transcribed Text files could be large to store on sql lite database, stored on seperate directory. 
- **Video timestamp:**
- **Relevant files:**
    - /transcriptions/
    - /uploads/

#### Second kind

- **One line description:**
- **Type:** structured
- **Rationale:** user data to identify users seperatly with userid and file names of users
- **Video timestamp:**
- **Relevant files:**
  - /config/database.js

### CPU intensive task

- **One line description:** uses whispher to convert video url's / video files to text files 
- **Video timestamp:** 
- **Relevant files:**
    - /app.js

### CPU load testing method

- **One line description:** submit a video url to transcribe to a text file
- **Video timestamp:** 
- **Relevant files:**
    - /app.js

Additional criteria
------------------------------------------------

### Extensive REST API features

- **One line description:** Not attempted
- **Video timestamp:**
- **Relevant files:**
    - 


### Use of external API(s)

- **One line description:** uses Assembly AI endpoint convert large video files to Text files
- **Video timestamp:**
- **Relevant files:**
    - /app.js (line 307)


### Extensive web client features

- **One line description:** Not attempted
- **Video timestamp:**
- **Relevant files:**
    - 


### Sophisticated data visualisations

- **One line description:** Not attempted
- **Video timestamp:**
- **Relevant files:**
    - 


### Additional kinds of data

- **One line description:** Not attempted
- **Video timestamp:**
- **Relevant files:**
    - 


### Significant custom processing

- **One line description:** uses transcribe-anything plugin locally to render video files to subtitle (text files)
- **Video timestamp:**
- **Relevant files:**
    - /app.js (line 213)


### Live progress indication

- **One line description:** A animation being showed for the user, until the file is completed and downloaded to the user
- **Video timestamp:** 
- **Relevant files:**
    - /views/progress.ejs


### Infrastructure as code

- **One line description:** Docker compose and Cloud Formation template has been implemented. Docker compose used to start the container in ec2 instance. and Cloud Formation template has been implemented to spin up a EC2 instance from created Launch template.
- **Video timestamp:** 
- **Relevant files:**
    - 


### Other

- **One line description:** Not attempted
- **Video timestamp:**
- **Relevant files:**
    - 
