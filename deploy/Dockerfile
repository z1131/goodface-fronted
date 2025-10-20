# Nginx image for goodface-fronted with static assets baked in
FROM nginx:1.25-alpine

# Copy nginx site config
COPY ./deploy/nginx.conf /etc/nginx/conf.d/default.conf

# Copy static frontend assets
COPY ./index.html /usr/share/nginx/html/
COPY ./config.html /usr/share/nginx/html/
COPY ./interview.html /usr/share/nginx/html/
COPY ./login.html /usr/share/nginx/html/
COPY ./user.html /usr/share/nginx/html/
COPY ./css /usr/share/nginx/html/css
COPY ./js /usr/share/nginx/html/js