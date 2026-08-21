/**
 * SurveyForm GAS Web App — action=write / read 라우팅 + Shared Secret 검증
 * 배포: 확장 프로그램 > Apps Script > 배포 > 새 배포 > 웹 앱 (액세스: 모든 사용자)
 * Script Properties에 SHARED_SECRET 등록 필요 (Next.js GAS_SHARED_SECRET과 동일)
 */

function doPost(e) {
  return handleRequest(e);
}
function doGet(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var expected = props.getProperty('SHARED_SECRET') || '';
    // Secret 검증: Authorization Bearer 또는 payload/header
    var got = '';
    if (e && e.headers && e.headers['Authorization']) got = e.headers['Authorization'].replace('Bearer ', '');
    if (!got && e && e.parameter && e.parameter.secret) got = e.parameter.secret;
    // Apps Script는 headers 소문자로 올 수 있음 / postData에서 전달된 경우
    if (!got) {
      try {
        var raw = e.postData ? e.postData.contents : '';
        if (raw) {
          var body = JSON.parse(raw);
          if (body._secret) got = body._secret;
        }
      } catch (_) {}
    }
    // 헤더 fallback: Next.js가 Authorization으로 보냄 — Apps Script에선 e.headers 미지원 케이스가 있어
    // 요청 헤더 대신 payload 내부 검증을 보조로 사용. 최종은 e.parameter.action으로 라우팅 전 검증.
    // GAS Web App으로 fetch 시 Authorization 헤더는 e.headers에 안 들어올 수 있으므로, postData 헤더 파싱 시도
    // 가장 확실한 방법은 GAS_SHARED_SECRET을 payload에 함께 보내지 않고 헤더로만 보내므로,
    // 아래처럼 e.headers 대문자/소문자 모두 체크
    if (!got && e && e.headers) {
      got = e.headers['authorization'] || e.headers['Authorization'] || '';
      if (got) got = got.replace(/^Bearer\s+/i, '');
    }
    if (expected && got !== expected) {
      return jsonResponse({ error: 'Unauthorized: invalid secret' }, 401);
    }

    var action = (e.parameter && e.parameter.action) || 'write';
    if (action === 'write') return handleWrite(e);
    if (action === 'read') return handleRead(e);
    return jsonResponse({ error: 'unknown action: ' + action }, 400);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

function handleWrite(e) {
  var sheet = getSheet();
  var payload = {};
  try {
    payload = e.postData ? JSON.parse(e.postData.contents) : {};
  } catch (_) {
    payload = e.parameter || {};
  }
  var row = payload.row || payload;
  // row가 객체면 키 순서대로 시트 헤더에 맞춰 append
  var headers = getHeaders(sheet);
  // 헤더가 없으면 row 키로 헤더 생성
  if (headers.length === 0) {
    headers = Object.keys(row);
    sheet.appendRow(headers);
  }
  var values = headers.map(function(h) {
    var v = row[h];
    if (Array.isArray(v)) return v.join(', ');
    if (v == null) return '';
    return String(v);
  });
  // 누락된 키가 있으면 헤더 확장
  var missing = Object.keys(row).filter(function(k) { return headers.indexOf(k) === -1; });
  if (missing.length > 0) {
    // 헤더 확장: 기존 헤더 뒤에 추가
    var newHeaders = headers.concat(missing);
    sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
    values = newHeaders.map(function(h) {
      var v = row[h];
      if (Array.isArray(v)) return v.join(', ');
      if (v == null) return '';
      return String(v);
    });
  }
  sheet.appendRow(values);
  return jsonResponse({ ok: true, written: values });
}

function handleRead(e) {
  var sheet = getSheet();
  var values = sheet.getDataRange().getValues();
  if (values.length === 0) return jsonResponse({ rows: [] });
  var headers = values[0].map(function(h){ return String(h); });
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) obj[headers[j]] = values[i][j] ? String(values[i][j]) : '';
    rows.push(obj);
  }
  return jsonResponse({ rows: rows, count: rows.length });
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No active spreadsheet. 시트에서 Apps Script를 열었는지 확인하세요.');
  var sheet = ss.getActiveSheet();
  if (!sheet) sheet = ss.getSheets()[0];
  return sheet;
}
function getHeaders(sheet) {
  if (sheet.getLastRow() === 0) return [];
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  // 빈 헤더 제거
  return headers.map(function(h){ return String(h).trim(); }).filter(function(h){ return h !== ''; });
}
function jsonResponse(obj, status) {
  var out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}
