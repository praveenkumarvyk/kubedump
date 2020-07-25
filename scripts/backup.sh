#!/bin/sh

PREFIX=$1
MOUNT_NAME=$2
SUBPATH_MOUNTS=$3
MOUNT_PATH=$(pwd)
PREFIX_PATH=$MOUNT_PATH/$PREFIX

DRY_ECHO=
if [ "$KUBEDUMP_DRYRUN" = "true" ]; then
  DRY_ECHO=echo
fi

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

main() {
  deps
  prepare
  package
  create_payload
}

deps() {
  if [ ! $HAS_TAR ]; then
    if [ "$OS" = "ubuntu" ]; then
      apt-get update && apt-get install -y tar
    elif [ "$OS" = "alpine" ]; then
      apk add --no-cache tar
    elif [ "$OS" = "arch" ]; then
      yes | pacman -Sy tar
    fi
  fi
  if [ ! $HAS_TAR ] && [ ! $HAS_ZIP ]; then
    echo failed to backup
    exit 1
  fi
}

prepare() {
  $DRY_ECHO cd $MOUNT_PATH
  $DRY_ECHO mkdir -p $PREFIX
}

package() {
  SUBPATHS=$(echo $SUBPATH_MOUNTS | sed 's/,/ /g')
  if [ "$SUBPATHS" ]; then
    for sub in $SUBPATHS; do
      if [ $sub != $PREFIX ]; then
        package_mount $MOUNT_PATH/$sub $sub
      fi
    done
  else
    package_mount $MOUNT_PATH $MOUNT_NAME
  fi
}

package_mount() {
  MOUNT_PATH=$1
  MOUNT_NAME=$2
  CWD=$(pwd)
  $DRY_ECHO cd $MOUNT_PATH
  if [ $HAS_TAR ]; then
    $DRY_ECHO tar --exclude "./$PREFIX" --exclude "./${PREFIX}_backup.sh" -czvf "${PREFIX_PATH}/${MOUNT_NAME}.tar.gz" .
  elif [ $HAS_ZIP ]; then
    echo zipping
  fi
  $DRY_ECHO cd $CWD
}

create_payload() {
  CWD=$(pwd)
  $DRY_ECHO cd $PREFIX_PATH
  $DRY_ECHO mkdir -p $PREFIX_PATH/payload
  if [ $HAS_TAR ]; then
    $DRY_ECHO tar --exclude './payload' -czvf $PREFIX_PATH/payload/payload.tar.gz .
  elif [ $HAS_ZIP ]; then
    echo zipping
  fi
  $DRY_ECHO cd $CWD
}

folders() {
  for i in $(ls -d */); do
    CWD=$(pwd)
    if [ "$CWD" != "/" ]; then
      CWD=$CWD/
    fi
    echo ${CWD}${i%?}
  done
}

mounts() {
  for i in $(df 2>/dev/null | sed 's/[^ ]* //g'); do
    if [ "$(echo $i | cut -c 1)" = "/" ]; then
      echo $i
    fi
  done
}

main
