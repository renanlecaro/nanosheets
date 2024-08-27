#!/bin/bash
DOMAIN="nanosheets.lecaro.me"
ssh staging "mkdir -p /opt/mup-nginx-proxy/config/html/static_sites/$DOMAIN"
rsync -avz --delete --delete-excluded --exclude="*.sh" --exclude="node_modules" --exclude=".*"  . staging:/opt/mup-nginx-proxy/config/html/static_sites/$DOMAIN
