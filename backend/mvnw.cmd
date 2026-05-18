@REM ----------------------------------------------------------------------------
@REM Licensed to the Apache Software Foundation (ASF) under one
@REM or more contributor license agreements.  See the NOTICE file
@REM distributed with this work for additional information
@REM regarding copyright ownership.  The ASF licenses this file
@REM to you under the Apache License, Version 2.0 (the
@REM "License"); you may not use this file except in compliance
@REM with the License.  You may obtain a copy of the License at
@REM
@REM     https://www.apache.org/licenses/LICENSE-2.0
@REM
@REM Unless required by applicable law or agreed to in writing,
@REM software distributed under the License is distributed on an
@REM "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
@REM KIND, either express or implied.  See the License for the
@REM specific language governing permissions and limitations
@REM under the License.
@REM ----------------------------------------------------------------------------

@echo off
setlocal

set MAVEN_PROJECTBASEDIR=%~dp0
if "%MAVEN_PROJECTBASEDIR%"=="" set MAVEN_PROJECTBASEDIR=.

@REM If path ends with backslash, quoting it as an argument may escape the closing quote.
@REM Trim trailing backslash to avoid passing a stray quote to Java.
if "%MAVEN_PROJECTBASEDIR:~-1%"=="\" set MAVEN_PROJECTBASEDIR=%MAVEN_PROJECTBASEDIR:~0,-1%

set WRAPPER_JAR=%MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper.jar
set WRAPPER_LAUNCHER=org.apache.maven.wrapper.MavenWrapperMain

if exist "%WRAPPER_JAR%" goto Execute

echo Maven wrapper jar not found. Downloading...
"%JAVA_HOME%\bin\java.exe" -version >NUL 2>&1
if %ERRORLEVEL% EQU 0 goto JavaHomeOk

where java >NUL 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo Java is required to run Maven Wrapper.
  exit /b 1
)

:JavaHomeOk
pushd "%MAVEN_PROJECTBASEDIR%" >NUL
javac .mvn\wrapper\MavenWrapperDownloader.java >NUL 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo Failed to compile MavenWrapperDownloader.java
  popd >NUL
  exit /b 1
)
java -cp .mvn\wrapper MavenWrapperDownloader "%MAVEN_PROJECTBASEDIR%" >NUL 2>&1
popd >NUL
if exist "%WRAPPER_JAR%" goto Execute

pushd "%MAVEN_PROJECTBASEDIR%" >NUL
java -cp .mvn\wrapper MavenWrapperDownloader "%MAVEN_PROJECTBASEDIR%"
popd >NUL

:Execute
set MAVEN_OPTS=%MAVEN_OPTS%

java -classpath %WRAPPER_JAR% "-Dmaven.multiModuleProjectDirectory=%MAVEN_PROJECTBASEDIR%" %WRAPPER_LAUNCHER% %*
