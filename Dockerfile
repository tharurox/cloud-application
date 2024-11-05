FROM amazonlinux:latest

WORKDIR /opt

RUN yum install -y python wget npm tar xz git
RUN wget https://bootstrap.pypa.io/get-pip.py
RUN python get-pip.py
RUN wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
RUN tar -xf ffmpeg-release-amd64-static.tar.xz
RUN cd  ffmpeg-7.0.2-amd64-static/
RUN ln -s /opt/ffmpeg-7.0.2-amd64-static/ffmpeg /usr/bin/ffmpeg

    
RUN pip install transcribe-anything
RUN pip install numpy==1.26.4
RUN git clone https://github.com/tharurox/cloud-application.git
RUN mv cloud-application app
#COPY cloud-application /opt/app

WORKDIR /opt/app

RUN npm install child_process passport jsonwebtoken install express multer fluent-ffmpeg ejs axios fs form-data aws-sdk

EXPOSE 3000
CMD [ "node", "app.js"]