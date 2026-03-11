import { ALARM_CLASSIFY_UPS, ALARM_UPDATE_UP_LIST, classifyUpTask, handleMessage, handleAlarm, scheduleAlarms, updateUpListTask } from "../background/service-worker.js";
import { assert, test } from "../tests/test-runner.js";
test("scheduleAlarms registers both alarms", () => {
    const created = [];
    const alarms = {
        create: (name, info) => {
            created.push({ name, periodInMinutes: info.periodInMinutes });
        },
        onAlarm: { addListener: () => { } }
    };
    scheduleAlarms(alarms);
    assert(created.length === 2, "expected two alarms");
});
test("updateUpListTask uses uid and saves list", async () => {
    let saved = 0;
    const ok = await updateUpListTask({
        uid: 1,
        getValueFn: async () => null,
        getFollowedUPsFn: async () => [{ mid: 1, name: "UP", face: "", sign: "", follow_time: 1 }],
        saveUPListFn: async () => {
            saved += 1;
        }
    });
    assert(ok, "expected ok");
    assert(saved === 1, "expected save once");
});
test("updateUpListTask reads uid from settings", async () => {
    let saved = 0;
    const ok = await updateUpListTask({
        getValueFn: async (key) => key === "settings" ? { userId: 9 } : null,
        getFollowedUPsFn: async () => [{ mid: 1, name: "UP", face: "", sign: "", follow_time: 1 }],
        saveUPListFn: async () => {
            saved += 1;
        }
    });
    assert(ok, "expected ok");
    assert(saved === 1, "expected save once");
});
test("classifyUpTask stores tags", async () => {
    const stored = {};
    const count = await classifyUpTask({
        getUPVideosFn: async () => [],
        getUPInfoFn: async () => ({ mid: 1, name: "A", sign: "", face: "" }),
        getVideoTagsFn: async () => [],
        getValueFn: async (key) => {
            if (key === "upList") {
                return { upList: [{ mid: 1 }, { mid: 2 }] };
            }
            if (key === "upTags") {
                return {};
            }
            return null;
        },
        setValueFn: async (_key, value) => {
            stored[_key] = value;
        },
        classifyUPFn: async (mid) => ({ mid, tags: ["AI"], confidence: 0.5, videoCount: 2 }),
        batchSize: 1
    });
    assert(count === 2, "expected two classified");
    const upTags = stored["upTags"];
    assert(upTags["1"][0] === "AI", "expected AI tag");
    const videoCounts = stored["videoCounts"];
    assert(videoCounts["1"] === 2, "expected video count");
});
test("handleAlarm routes to update and classify", async () => {
    let updated = 0;
    let classified = 0;
    await handleAlarm({ name: ALARM_UPDATE_UP_LIST }, {
        uid: 1,
        getValueFn: async () => null,
        getFollowedUPsFn: async () => [],
        saveUPListFn: async () => {
            updated += 1;
        }
    });
    await handleAlarm({ name: ALARM_CLASSIFY_UPS }, {
        getValueFn: async (key) => key === "upList" ? { upList: [{ mid: 1 }] } : {},
        setValueFn: async () => {
            classified += 1;
        },
        classifyUPFn: async (mid) => ({ mid, tags: [], confidence: 0.3, videoCount: 0 })
    });
    assert(updated === 1, "expected update handler");
    assert(classified === 3, "expected classify handler");
});
test("handleMessage random_up opens space url", async () => {
    let url = "";
    await handleMessage({ type: "random_up" }, {
        getValueFn: async () => ({ upList: [{ mid: 2 }] }),
        randomUPFn: () => ({ mid: 2, name: "A", face: "", sign: "", follow_time: 1 }),
        tabs: {
            update: (tabId, info) => {
                url = info.url;
            }
        }
    });
    assert(url.includes("space.bilibili.com/2"), "expected space url");
});
test("handleMessage watch_event updates interest", async () => {
    let updated = 0;
    await handleMessage({ type: "watch_event", payload: { bvid: "BV1", watch_time: 10, duration: 20 } }, {
        getVideoTagsFn: async () => ["AI"],
        updateInterestFromWatchFn: async () => {
            updated += 1;
            return [];
        }
    });
    assert(updated === 1, "expected interest update");
});
test("handleMessage detect_uid updates settings", async () => {
    let savedSettings = null;
    let savedUserId = null;
    await handleMessage({ type: "detect_uid", payload: { uid: 123 } }, {
        getValueFn: async (key) => (key === "settings" ? { userId: 1 } : null),
        setValueFn: async (key, value) => {
            if (key === "settings")
                savedSettings = value;
            if (key === "userId")
                savedUserId = value;
        }
    });
    const settings = savedSettings;
    assert(settings.userId === 123, "expected updated userId");
    assert(savedUserId === 123, "expected stored userId");
});
test("handleMessage recommend_video opens video url", async () => {
    let url = "";
    const result = await handleMessage({ type: "recommend_video" }, {
        recommendUPFn: async () => ({ mid: 1, name: "A", face: "", sign: "", follow_time: 1 }),
        recommendVideoFn: async () => ({
            bvid: "BV1",
            aid: 1,
            title: "A",
            play: 1,
            duration: 1,
            pubdate: 1,
            tags: []
        }),
        tabs: {
            update: (tabId, info) => {
                url = info.url;
            }
        }
    });
    assert(url.includes("www.bilibili.com/video/BV1"), "expected video url");
    assert(result?.title === "A", "expected title");
});
test("handleMessage update_up_list triggers update", async () => {
    let updated = 0;
    await handleMessage({ type: "update_up_list" }, {
        uid: 1,
        getValueFn: async () => null,
        getFollowedUPsFn: async () => [],
        saveUPListFn: async () => {
            updated += 1;
        },
        tabs: {
            update: () => { }
        }
    });
    assert(updated === 1, "expected update called");
});
test("handleMessage classify_ups triggers classify", async () => {
    let stored = 0;
    await handleMessage({ type: "classify_ups" }, {
        getValueFn: async (key) => key === "upList" ? { upList: [{ mid: 1 }] } : {},
        setValueFn: async () => {
            stored += 1;
        },
        classifyUPFn: async (mid) => ({ mid, tags: [], confidence: 0.3, videoCount: 0 }),
        tabs: {
            update: () => { }
        }
    });
    assert(stored === 3, "expected classify store calls");
});
test("handleMessage clear_classify_data resets data", async () => {
    const stored = {};
    await handleMessage({ type: "clear_classify_data" }, {
        tabs: {
            update: () => { }
        },
        setValueFn: async (key, value) => {
            stored[key] = value;
        }
    });
    assert(Object.keys(stored).length === 3, "expected three keys cleared");
    assert(JSON.stringify(stored["upTags"]) === "{}", "expected empty upTags");
});
test("handleMessage probe_up returns info", async () => {
    const result = await handleMessage({ type: "probe_up", payload: { mid: 1 } }, {
        tabs: {
            update: () => { }
        }
    });
    assert(result !== null, "expected result");
});
