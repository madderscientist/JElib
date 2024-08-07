import jpnet from './onnxData.js';

var model = null;
const classmap = [0, 1, 10, 11, 2, 3, 4, 5, 6, 7, 8, 9];
const modelPath = `${wx.env.USER_DATA_PATH}/jpnet_v1.onnx`;

// 保存模型到model
export async function loadModel() {
    wx.showLoading({
        title: '模型加载中',
        mask: true
    });
    if (!await saveModel()) {
        wx.hideLoading();
        wx.showToast({
            title: "模型加载失败！",
            duration: 2000,
            icon: "error"
        }); return;
    }
    function succ() {
        console.log('session loaded');
        wx.hideLoading();
        wx.showToast({
            title: "模型加载成功！",
            duration: 800,
            icon: "success"
        });
    }
    AIcontext().then(succ).catch(async (e) => {
        console.error(e);
        await saveModel(true);      // 首先怀疑是否是文件损坏，强制重新下载
        AIcontext().then(succ).catch((e)=>{
            wx.hideLoading();
            wx.showToast({
                title: "模型加载失败！",
                duration: 2000,
                icon: "error"
            });
        });
    });
}

function AIcontext() {  // Promise封装
    return new Promise((resolve, reject) => {
        model = wx.createInferenceSession({
            model: modelPath,
            precisionLevel: 4, // 直接用最高精度，不然结果有出入
            allowNPU: false, // 是否使用 NPU 推理，仅针对 IOS 有效
            allowQuantize: false, // 是否产生量化模型
        });
        // 监听error事件
        model.onError(reject);
        // 监听模型加载完成事件
        model.onLoad(resolve);
    })
}

export async function reco(jspic) {
    const input = new Float32Array(expandJspic(jspic));
    const results = await model.run({
        input: {
            shape: [1, 1, 18, 16], // 输入形状 NCHW 值
            data: input.buffer, // 为一个 ArrayBuffer
            type: 'float32', // 输入数据类型
        },
    });
    const output = new Float32Array(results.output.data);
    return classmap[argmax(output)];
}

function expandJspic(JSPIC) {
    const arrays = JSPIC.channel[0];
    const input = new Uint8Array(JSPIC.width * JSPIC.height);
    let offset = 0;
    for (const arr of arrays) {
        input.set(arr, offset);
        offset += arr.length;
    }
    return input;
}

function argmax(arr) {
    let max = arr[0];
    let maxIndex = 0;
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] > max) {
            maxIndex = i;
            max = arr[i];
        }
    }
    return maxIndex;
}



// 由于onnx不能被直接加载，所以需要将模型保存到本地
async function saveModel(forceLoad = false) {
    try {
        if(forceLoad || !await checkExist(modelPath)) await write(jpnet.buffer, modelPath);
        return await checkExist(modelPath);
    } catch (e) {
        console.error(e);
        return false;
    }
}
function checkExist(path) {
    return new Promise((resolve) => {
        const fs = wx.getFileSystemManager()
        fs.access({
            path: path,
            success(res) {
                resolve(true);
            },
            fail(res) {
                resolve(false);
            }
        });
    });
}
// 写入文件
function write(arraybuffer, targetPath) {
    return new Promise((resolve, reject) => {
        wx.getFileSystemManager().writeFile({
            filePath: targetPath,
            data: arraybuffer,
            encoding: 'binary',
            success: function () {
                console.log('模型保存成功');
                resolve();
            },
            fail: function (err) {
                console.error('模型保存失败', err);
                reject(err);
            }
        });
    });
}