FROM amazonlinux:latest

WORKDIR /opt

RUN yum install -y python wget npm tar xz git \
     wget https://bootstrap.pypa.io/get-pip.py \
     python get-pip.py \
     wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz \
     tar -xf ffmpeg-release-amd64-static.tar.xz \
     cd  ffmpeg-7.0.2-amd64-static/ \
     ln -s /opt/ffmpeg-7.0.2-amd64-static/ffmpeg /usr/bin/ffmpeg 


RUN pip install transcribe-anything numpy==1.26.4
RUN git clone https://github.com/tharurox/cloud-application.git \
    mv cloud-application app
#COPY cloud-application /opt/app

WORKDIR /opt/app

RUN npm install express multer fluent-ffmpeg ejs axios fs form-data

EXPOSE 3000
CMD [ "node", "app.js"]