#!/bin/bash
DOMAIN="nanosheets.lecaro.me"
ssh root@128.140.45.246 "mkdir -p /opt/mup-nginx-proxy/config/html/static_sites/$DOMAIN"
rsync -avz --delete --delete-excluded --exclude="*.sh" --exclude="node_modules" --exclude=".*"  . root@128.140.45.246:/opt/mup-nginx-proxy/config/html/static_sites/$DOMAIN
