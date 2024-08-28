FROM amazonlinux:latest

WORKDIR /opt

RUN yum install -y python wget npm tar xz
RUN wget https://bootstrap.pypa.io/get-pip.py
RUN wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
RUN tar -xf ffmpeg-release-amd64-static.tar.xz
RUN cd  ffmpeg-7.0.2-amd64-static/
RUN ln -s /opt/ffmpeg-7.0.2-amd64-static/ffmpeg /usr/bin/ffmpeg


#RUN pip install -y transcribe-anything
COPY cloud-application /opt/app

WORKDIR /opt/app

RUN npm install express multer fluent-ffmpeg ejs

EXPOSE 3000
CMD [ "node", "app.js" ]