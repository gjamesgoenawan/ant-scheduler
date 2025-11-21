# build frontend
cd src/frontend/ && npm install && npm run build && cd ../../
# generate certificate for 1 year
mkdir cert  && cd cert && openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=ant-scheduler" && cd ..