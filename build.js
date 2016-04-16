#!/usr/bin/env node

var fs = require('fs')
var path = require('path')

var ROOT = '.'
var SOURCE = path.join(ROOT, 'src')
var BUILD = path.join(ROOT, 'build')
var TARGET = path.join(ROOT, 'build')
var TEMPLATE = path.join(ROOT, 'template')
var TEMPLATE_PATTERN = /\{\{([^}]+)\}\}/ig
var LANG_TEMPLATE = path.join(TEMPLATE, 'selectlang.html')

var WORDS_FILE = 'words.csv'
var LANG_FILE = 'langs.csv'

// テンプレートを Cacheする変数
var _templates

// ビルドフォルダーを消す
rmrf(BUILD)

var SELECTED_LANG = selectLangs(LANG_FILE)
var ALL_VARIABLES = readLangCSV(WORDS_FILE, SELECTED_LANG)

// 一旦、languageSettingsを作成
var languageSettings = []

SELECTED_LANG.map(function(lang, index){
  languageSettings.push('"' +lang + ':'+ ALL_VARIABLES[lang].langName + '"')
})

// ソースファイルをプロゼスしてターゲットフォルダーに書き出す
SELECTED_LANG.map(function(lang, index){
  processFiles(SOURCE, path.join(TARGET, lang), ALL_VARIABLES[lang])
})
processFiles(path.join(ROOT, 'global'), TARGET, {})

function processFiles (source, target, variables) {
  _templates = {}
  find(source)
    .forEach(
      (file) => processFile(source, target, variables, file)
    )
}


function processFile (source, target, variables, fileName) {
  var sourceFile = path.join(source, fileName)
  var targetFile = path.join(target, fileName)
  var data = readAndReplaceFile(variables, sourceFile, fileName)
  mkdirp(path.dirname(targetFile))
  fs.writeFileSync(targetFile, data)
}

function readAndReplaceFile (variables, file, relative) {
  var data = fs.readFileSync(file, 'utf8')
  return data.replace(TEMPLATE_PATTERN,
    fillPlaceholder.bind(null, Object.assign({
      file: relative,
      path: relative.substr(0, relative.length - path.extname(relative).length),
      languageSettings: languageSettings
    }, variables))
  )
}

function find (folder) {
  return fs
    .readdirSync(folder)
    .filter(
      // . ファイルを無視する
      (fileName) => fileName.charAt(0) !== '.'
    )
    .reduce(
      (files, fileName) => {
        var pth = path.join(folder, fileName)
        var stat = fs.statSync(pth)
        if (stat.isDirectory()) {
          files = files.concat(
            find(pth)
              .map((child) => path.join(fileName, child))
          )
        } else if (stat.isFile()) {
          files.push(fileName)
        }
        return files
      }
      , [])
}

function mkdirp (folder) {
  // フォルダーがあるように確認する
  return folder
    .split(path.sep)
    .reduce(
      (parent, current) => {
        current = path.join(parent, current)
        if (!fs.existsSync(current)) {
          fs.mkdirSync(current)
        }
        return current
      }
      , '')
}

function rmrf (folder) {
  try {
    fs
      .readdirSync(folder)
      .forEach(
        (fileName) => {
          var pth = path.join(folder, fileName)
          var stat = fs.statSync(pth)
          if (stat.isDirectory()) {
            rmrf(pth)
          } else if (stat.isFile()) {
            fs.unlinkSync(pth)
          }
        }
      )
    fs.rmdirSync(folder)
  } catch (e) {}
}

function fillPlaceholder (variables, full, name) {
  // hoge.huga のディープルックアップをやります。
  var parts = name.split('.')
  var current = variables
  while (current && parts.length > 0) {
    current = current[parts.shift()]
  }
  return current ||
    getTemplate(variables, name + '.html') // なければテンプレートフォルダー
}

function getTemplate (variables, name) {
  if (!_templates[name]) {
    _templates[name] = readAndReplaceFile(variables, path.join(TEMPLATE, name), name)
  }
  return _templates[name]
}

function readLangCSV (file, languages) {
  var result = {}
  readCSV(file).forEach((line) => {
    languages.forEach((lang) => {
      var tree = [lang].concat((line.id || '').split('.'))
      var parent = result
      for (var i = 0; i < tree.length - 1; i++) {
        var parentKey = tree[i]
        if (!parent[parentKey]) parent[parentKey] = {}

        parent = parent[parentKey]
      }
      parent[tree[tree.length - 1]] = line[lang]
    })
  })
  return result
}


function readCSV (file) {
  var csvParse

  try {
    csvParse = require('csv-parse/lib/sync')
  } catch (e) {
    throw new Error('`npm init y; npm i csv-parse` を読んでください。')
  }
  return csvParse(fs.readFileSync(path.join(ROOT, file), 'utf8'), {
    skip_empty_lines: true,
    columns: true
  })
}

function selectLangs(file){
  var result,
  csvParse = require('csv-parse/lib/sync');
  result = csvParse(fs.readFileSync(path.join(ROOT, file),'utf8'))
  return Array.prototype.concat.apply([], result);
}

