#!/usr/bin/env bash
#set -x

TARGET="../../digitraffic-ci/aws/cdk/road/config.ts"
SRC="bin/config.ts"

mkdir -p bin
if test -f "${TARGET}"; then
    read -p "${TARGET} exist, do you wan to see diff? [Y/N] " yn
    case $yn in
        [Yy]* ) echo "diff:" && diff -U5 "${TARGET}" "${SRC}";;
        [Nn]* ) ;;
        * ) echo "Please answer yes or no.";;
    esac
fi

if test -f "${TARGET}"; then
  read -p "Do you want to over write ${TARGET}? [Y/N] " yn
  case $yn in
      [Yy]* ) cp "${SRC}" "${TARGET}";;
      [Nn]* ) echo "${TARGET} untouched";;
      * ) echo "Please answer yes or no.";;
  esac
else
  cp "${SRC}" "${TARGET}"
fi