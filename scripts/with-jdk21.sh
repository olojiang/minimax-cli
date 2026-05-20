#!/usr/bin/env bash
set -euo pipefail

if [[ "${JAVA_HOME:-}" == *"21"* ]] && [[ -x "${JAVA_HOME}/bin/java" ]]; then
  exec "$@"
fi

for candidate in \
  "/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" \
  "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" \
  "/Library/Java/JavaVirtualMachines/openjdk-21.jdk/Contents/Home" \
  "/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home"
do
  if [[ -x "${candidate}/bin/java" ]]; then
    export JAVA_HOME="${candidate}"
    export PATH="${JAVA_HOME}/bin:${PATH}"
    exec "$@"
  fi
done

echo "Android 构建需要 JDK 21。请先安装 openjdk@21，或设置 JAVA_HOME 指向 JDK 21。"
exit 1
