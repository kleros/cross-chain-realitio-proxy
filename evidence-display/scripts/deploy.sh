#!/usr/bin/env bash
function usage {
  echo "./$(basename $0) [-v] [-s]"
  echo ""
  echo -e "\t-v\tVerbose output"
  echo -e "\t-s\tSkip build"
}

# list of arguments expected in the input
optstring=":hvs"

VERBOSE=0
SKIP_BUILD=0

while getopts ${optstring} arg; do
  case ${arg} in
    h)
      echo "Usage:"
      usage
      exit 0
      ;;
    v)
      VERBOSE=1
      ;;
    s)
      SKIP_BUILD=1
      ;;
    ?)
      echo "Invalid option: -${OPTARG}."
      usage
      exit 2
      ;;
  esac
done

SCRIPTS_DIR=scripts
BUILD_DIR=build
COMPACTED_FILE_NAME="xchain-realitio-evidence-display.tar.gz"
COMPACTED_FILE_PATH="${SCRIPTS_DIR}/${COMPACTED_FILE_NAME}"
REMOTE_DIRECTORY='~/cross-chain-realitio'

IPFS_HOST_ADDR=ec2-18-222-255-9.us-east-2.compute.amazonaws.com
IPFS_HOST_USER=ubuntu

remote_command() {
  ssh "${IPFS_HOST_USER}@${IPFS_HOST_ADDR}" "bash -c '$1'"
}

build-app() {
  if [ $SKIP_BUILD -eq 0 ]; then
    if [ $VERBOSE -eq 1 ]; then
      echo 'Building the app...'

      [ -f .env ] && source .env
      echo ""
      echo -e "Using current env vars:\n"
      echo -e "\tREACT_APP_FOREIGN_CHAIN_RPC_ENDPOINT:" ${REACT_APP_FOREIGN_CHAIN_RPC_ENDPOINT}
      echo -e "\tREACT_APP_HOME_CHAIN_RPC_ENDPOINT:" ${REACT_APP_HOME_CHAIN_RPC_ENDPOINT}
      echo -e "\tREACT_APP_OMEN_SUBGRAPH_ENDPOINT:" ${REACT_APP_OMEN_SUBGRAPH_ENDPOINT}
      echo -e "\tREACT_APP_OMEN_URL_TEMPLATE:" ${REACT_APP_OMEN_URL_TEMPLATE}
      echo -e "\tREACT_APP_REALITY_ETH_URL_TEMPLATE:" ${REACT_APP_REALITY_ETH_URL_TEMPLATE}
      echo ""

    fi

    [ $VERBOSE -eq 1 ] && YARN_OPTS='' || YARN_OPTS='-s'
    yarn ${YARN_OPTS} build
  fi
}

compact-local-dir() {
  if [ -f "$COMPACTED_FILE_PATH" ]; then
    [ $VERBOSE -eq 1 ] && echo 'Removing existing file...'
    rm -rf "$COMPACTED_FILE_PATH"
  fi

  [ $VERBOSE -eq 1 ] && echo 'Compacting build dir...'
  [ $VERBOSE -eq 1 ] && TAR_OPTS='-cvzf' || TAR_OPTS='-czf'
  tar $TAR_OPTS "${COMPACTED_FILE_PATH}" -C "${BUILD_DIR}" .
}

upload-file() {
  # Upload the File
  remote_command "mkdir -p ${REMOTE_DIRECTORY}"
  [ $VERBOSE -eq 1 ] && echo 'Uploading .tar.gz file to the IPFS node...'
  [ $VERBOSE -eq 1 ] && SCP_OPTS='' || SCP_OPTS='-q'
  scp ${SCP_OPTS} "${COMPACTED_FILE_PATH}" "${IPFS_HOST_USER}@${IPFS_HOST_ADDR}":"${REMOTE_DIRECTORY}"
}

extract-remote-file() {
  # Extract the file
  [ $VERBOSE -eq 1 ] && TAR_OPTS='-xvzf' || TAR_OPTS='-xzf'
  remote_command "mkdir -p ${REMOTE_DIRECTORY}/app; tar ${TAR_OPTS} ${REMOTE_DIRECTORY}/${COMPACTED_FILE_NAME} -C ${REMOTE_DIRECTORY}/app"
}

add-to-ipfs() {
  # Add the folder to IPFS
  [ $VERBOSE -eq 1 ] && echo 'Adding files to IPFS...'
  RESULT_HASH=$(remote_command "cd ${REMOTE_DIRECTORY}/app; ipfs add -Q -r .; cd")
}

cleanup() {
  # Cleanup
  [ $VERBOSE -eq 1 ] && echo 'Removing remote .tar.gz file...'
  remote_command "rm -rf ${REMOTE_DIRECTORY}"
  [ $VERBOSE -eq 1 ] && echo 'Removing local .tar.gz file...'
  rm -rf "$COMPACTED_FILE_PATH"
}

build-app &&
  compact-local-dir && \
  upload-file && \
  extract-remote-file && \
  add-to-ipfs && \
  cleanup

if [ $? -eq 0 ]; then
  echo "/ipfs/${RESULT_HASH}/index.html"
else
  echo "Failed to deploy!" >&2
fi
