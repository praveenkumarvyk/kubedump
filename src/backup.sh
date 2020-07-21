#!/bin/sh

PREFIX=$1
MOUNT_PATH=$(pwd)

IS_ALPINE=$(apk --version >/dev/null 2>&1 && echo true|| echo false)
IS_UBUNTU=$(apt-get --version >/dev/null 2>&1 && echo true|| echo false)
IS_ARCH=$(pacman --version >/dev/null 2>&1 && echo true|| echo false)
OS=unknown
if $IS_UBUNTU; then
  OS=ubuntu
elif $IS_ALPINE; then
  OS=alpine
elif $IS_ARCH; then
  OS=arch
fi

HAS_TAR=$(tar --version >/dev/null 2>&1 && echo true|| echo false)
HAS_ZIP=$(zip --version >/dev/null 2>&1 && echo true|| echo false)

if [ ! $HAS_TAR ]; then
  if [ $OS == "ubuntu" ]; then
    apt-get update && apt-get install -y tar
  elif [ $OS == "alpine" ]; then
    apk add --no-cache tar
  elif [ $OS == "arch" ]; then
    yes | pacman -Sy tar
  fi
fi

if [ $HAS_TAR ]; then
  echo tarring
elif [ $HAS_ZIP ]; then
  echo zipping
else
  echo failed to backup
  exit 1
fi
