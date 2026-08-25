/**
 * SurveyForm — Google Form 바인딩 스크립트 (선택: 네이티브 Form pre-filled용)
 * 배포: Google Form 편집 화면 → ⋮ → 스크립트 에디터 → 이 파일 붙여넣기
 * 트리거: 트리거 → onFormSubmit → 이벤트 소스: 폼에서 → 저장
 * Script Properties: WEBHOOK_URL, WEBHOOK_SECRET (Vercel과 동일값), TAXONOMY_MAP (JSON)
 *
 * 분류 예: 강의평가 { prof_name, course_name }, 학과 설문 { dept }
 * Form에 분류용 단답형 문항을 최하단에 배치하고, 제목에 분류 라벨(예: 교수명)을 포함하세요.
 * pre-filled 링크의 entry ID는 이 스크립트에서 사용하지 않음 — 제목 매칭으로 파싱합니다.
 */

var WEBHOOK_URL = PropertiesService.getScriptProperties().getProperty('WEBHOOK_URL') || '';
var WEBHOOK_SECRET = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET') || PropertiesService.getScriptProperties().getProperty('SHARED_SECRET') || '';
// 예: '[{"key":"prof_name","label":"교수명"},{"key":"dept","label":"학과명"}]' — AdminPanel에서 복사
var TAXONOMY_MAP_JSON = PropertiesService.getScriptProperties().getProperty('TAXONOMY_MAP') || '[]';

function onFormSubmit(e) {
  try {
    if (!WEBHOOK_URL) throw new Error('WEBHOOK_URL 미설정 (Script Properties)');
    var taxonomyMap = [];
    try { taxonomyMap = JSON.parse(TAXONOMY_MAP_JSON); } catch(_){ taxonomyMap = []; }
    var response = e.response;
    var itemResponses = response.getItemResponses();
    var taxonomy = {};
    var answers = [];
    for (var i = 0; i < itemResponses.length; i++) {
      var ir = itemResponses[i];
      var title = ir.getItem().getTitle() || '';
      var resp = ir.getResponse();
      var strResp = Array.isArray(resp) ? resp.join(', ') : String(resp || '');
      // 분류 필드 매칭: 제목에 라벨이 포함되면 분류로 취급
      var matched = null;
      for (var j = 0; j < taxonomyMap.length; j++) {
        if (title.indexOf(taxonomyMap[j].label) !== -1 || title.indexOf(taxonomyMap[j].key) !== -1) { matched = taxonomyMap[j]; break; }
      }
      if (matched) {
        taxonomy[matched.key] = strResp;
      } else {
        answers.push({ title: title, answer: resp });
      }
    }
    // 필수 검증
    for (var k = 0; k < taxonomyMap.length; k++) {
      var f = taxonomyMap[k];
      if (f.required && !taxonomy[f.key]) {
        console.warn('taxonomy missing: ' + f.label);
      }
    }
    var payload = {
      formId: e.source.getId(),
      taxonomy: taxonomy,
      answers: answers,
      respondentEmail: response.getRespondentEmail ? (response.getRespondentEmail() || '') : '',
      submittedAt: new Date().toISOString()
    };
    var opts = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'X-Webhook-Secret': WEBHOOK_SECRET },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    var res = UrlFetchApp.fetch(WEBHOOK_URL, opts);
    console.log('webhook status ' + res.getResponseCode() + ' body ' + res.getContentText().slice(0, 500));
  } catch (err) {
    console.error('onFormSubmit error: ' + err);
  }
}
