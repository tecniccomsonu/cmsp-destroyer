// ==UserScript==
// @author       tecnic
// @icon         https://cdn.discordapp.com/attachments/794266085682708536/1294296207954411530/imagem_2024-10-11_104916245-removebg-preview.png?ex=670a7ec6&is=67092d46&hm=4154f3204aee1b47191df1b2a5102f674b79a66b5792fc3055b2cf19bc8fc9e1&
// @name         cmsp destroyer
// @namespace    https://cmspweb.ip.tv/
// @description  cmsp destroyer
// @version      1.0
// @connect      cmsp.ip.tv
// @connect      edusp-api.ip.tv
// @match        https://cmsp.ip.tv/*
// @license      GNU Affero General Public License v3.0
// ==/UserScript==

(function() {
    'use strict';

    const lessonRegex = /https:\/\/cmsp\.ip\.tv\/mobile\/tms\/task\/\d+\/apply/;

    function transformJson(originalJson) {
        const newJson = {
            status: "submitted",
            accessed_on: originalJson.accessed_on,
            executed_on: originalJson.executed_on,
            answers: {}
        };

        Object.keys(originalJson.answers).forEach(questionId => {
            const question = originalJson.answers[questionId];
            const taskQuestion = originalJson.task.questions.find(q => q.id === parseInt(questionId));

            let answer;
            switch (taskQuestion.type) {
                case "order-sentences":
                    answer = taskQuestion.options.sentences.map(sentence => sentence.value);
                    break;
                case "fill-words":
                    answer = taskQuestion.options.phrase
                        .filter((_, index) => index % 2 !== 0)
                        .map(item => item.value);
                    break;
                case "text_ai":
                    answer = taskQuestion.comment.replace(/<\/?p>/g, '');
                    break;
                case "fill-letters":
                    answer = taskQuestion.options.answer;
                    break;
                case "cloud":
                    answer = taskQuestion.options.ids;
                    break;
                default:
                    answer = Object.fromEntries(
                        Object.keys(taskQuestion.options).map(optionId => [optionId, taskQuestion.options[optionId].answer])
                    );
            }

            newJson.answers[questionId] = {
                question_id: question.question_id,
                question_type: taskQuestion.type,
                answer
            };
        });

        return newJson;
    }

    let currentHref = document.location.href;
    const observer = new MutationObserver(() => {
        if (currentHref !== document.location.href) {
            currentHref = document.location.href;

            if (lessonRegex.test(currentHref)) {
                console.log("[DEBUG] LESSON DETECTED");

                const { auth_token: authKey } = JSON.parse(sessionStorage.getItem("cmsp.ip.tv:iptvdashboard:state")).auth;
                const { name: roomName } = JSON.parse(sessionStorage.getItem("cmsp.ip.tv:iptvdashboard:state")).room.room;
                const lessonId = currentHref.split("/")[6];

                console.log(`[DEBUG] LESSON_ID: ${lessonId} ROOM_NAME: ${roomName}`);

                const draftBody = {
                    status: "draft",
                    accessed_on: "room",
                    executed_on: roomName,
                    answers: {}
                };

                const sendRequest = (method, url, data, callback) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open(method, url);
                    xhr.setRequestHeader("X-Api-Key", authKey);
                    xhr.setRequestHeader("Content-Type", "application/json");
                    xhr.onload = () => callback(xhr);
                    xhr.onerror = () => console.error('Request failed');
                    xhr.send(data ? JSON.stringify(data) : null);
                };

                sendRequest("POST", `https://edusp-api.ip.tv/tms/task/${lessonId}/answer`, draftBody, (response) => {
                    console.log("[DEBUG] DRAFT_DONE, RESPONSE: ", response.responseText);
                    const { id: taskId } = JSON.parse(response.responseText);
                    const answersUrl = `https://edusp-api.ip.tv/tms/task/${lessonId}/answer/${taskId}?with_task=true&with_genre=true&with_questions=true&with_assessed_skills=true`;

                    sendRequest("GET", answersUrl, null, (response) => {
                        console.log("[DEBUG] Get Answers response received");
                        const answersResponse = JSON.parse(response.responseText);
                        const answersBody = transformJson(answersResponse);

                        console.log(`[DEBUG] Sending Answers... BODY: ${JSON.stringify(answersBody)}`);

                        sendRequest("PUT", `https://edusp-api.ip.tv/tms/task/${lessonId}/answer/${taskId}`, answersBody, (response) => {
                            if (response.status !== 200) {
                                alert(`[ERROR] An error occurred while sending the answers. RESPONSE: ${response.responseText}`);
                            } else {
                                console.log(`[DEBUG] Answers Sent! RESPONSE: ${response.responseText}`);

                                const watermark = document.querySelector('.MuiTypography-root.MuiTypography-body1.css-1exusee');
                                if (watermark) {
                                    setTimeout(() => {
                                        document.querySelector('button.MuiButtonBase-root.MuiButton-root.MuiLoadingButton-root.MuiButton-contained.MuiButton-containedInherit.MuiButton-sizeMedium.MuiButton-containedSizeMedium.MuiButton-colorInherit.css-prsfpd').click();
                                    }, 500);
                                }
                            }
                        });
                    });
                });
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
