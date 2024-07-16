// 依赖：jsPic JPnote
import jsPic from "./jsPic.js";
import JPnote from "./JPnote.js";

// 图片接口使用ImageData
export class JPreco {
    /**
     * @param {ImageData} imgdata
     * @param {function} recofun (jspic)=>classIndex，jspic的大小已经限定为了inputW*inputH
     * @param {number} minW 最小宽度
     */
    constructor(imgdata, recofun, minW = 800) {
        const p = new jsPic().fromImageData(imgdata, 'RGB');
        if (p.width < minW) {
            this.base = p.resize(minW, -1);
        } else {
            this.base = p;
        }
        this.reco1 = recofun;
        this.empty = null;
        this.notes = null;
    }

    async reco() {
        let [succset, failset] = JPrecoTools.findChar(this.base);
        let pic = this.base.convert('L');   // 用于识别的
        pic.throughChannel(0, (x) => 255 - x);
        {   // 第一次识别
            let [s, f] = await JPrecoTools.recoSet(pic, succset, this.reco1);
            succset = s;
            failset.push(...f);
        }
        // 统计形状和位置信息
        let [H, Y] = JPrecoTools.staticYH(succset);
        {   // 二次识别
            let [reduce_succ, reduce_failed] = JPrecoTools.reduceBox(H, Y, succset);
            let [add_succ, add_failed] = JPrecoTools.addBox(H, Y, failset);
            let [s, f] = await JPrecoTools.recoSet(pic, add_succ, this.reco1);
            const estiW = H * 0.8;
            failset = JPrecoTools.nms([...reduce_failed, ...add_failed, ...f], (box1, box2) => {
                let over = JPrecoTools.overlap(box1, box2);
                if (box1[2] > estiW || box2[2] > estiW) {    // 存在点和时长横线相合并的情况
                    let minArea = Math.min(box1[2] * box1[3], box2[2] * box2[3]);
                    return minArea * 0.8 < over;      // 如果是全包围了则不合并
                }
                return over > 4;
            });
            succset = [...reduce_succ, ...s];
        }
        // 合并音符
        this.notes = JPrecoTools.join(succset, failset, H);
        this.empty = JPrecoTools.iniEmpty(this.base, this.notes);
    }

    upx(by = 0) {
        let p = this.empty.clone();
        for (const n of this.notes) {
            n.note += by;
            n.draw(p);
        }
        return p.toImageData([0, 1, 2, -1]);
    }
};

// classIndex: '0'~'7': 0~7, '#': 8, 'b': 9, '♮': 10, 其他: 11
// 图片接口全部使用jsPic
export class JPrecoTools {
    static inputW = 16;
    static inputH = 18;
    /**
     * 预处理+定位。预处理为缩放和反色，定位返回符合要求的包围盒，和不符合要求的包围盒
     * @param {jsPic} jspicRGB 来自画布的ImageData转换为的RGB三通道的jsPic
     * @returns [jsPic, Array<[x,y,w,h]> success, Array<[x,y,w,h]> failed]
     */
    static findChar(jspicRGB) {
        let pic = jspicRGB.convert('L');
        JPrecoTools.specialBinarization(pic);       // 对pic进行二值化
        let successset = [];
        let failset = [];
        let [_, positions] = pic.connectedComponents();
        // 对包围盒进行过滤
        for (const pos of positions) {
            let [x, y, w, h, state] = pos;
            // 过滤掉不感兴趣(黑色)的区域
            if (!state) continue;
            if (JPrecoTools.shapeFilter(w, h)) {
                successset.push([x, y, w, h]);
            } else {
                failset.push([x, y, w, h]);
            }
        } return [successset, failset];
    }
    /**
     * 识别并返回结果
     * @param {jsPic} JSPIC 反色后的jspic
     * @param {Array} inputSet 要识别的包围盒的集合
     * @param {Function} reco (jspic)=>classIndex，jspic的大小已经限定为了inputW*inputH
     * @returns [Array<[x,y,w,h,class]> success, Array<[x,y,w,h]> failed]
     */
    static async recoSet(JSPIC, inputSet, reco) {
        let successset = [];
        let failedset = [];
        for (const box of inputSet) {
            let cropped = JPrecoTools.cropToInput(JSPIC, box);
            if (!cropped) {
                failedset.push(box);
                continue;
            }
            let result = await reco(cropped);
            // 将识别结果用绿色绘制在succset[i]的位置上
            if (result == 11) {
                failedset.push(box);
                continue;
            }
            successset.push([...box, result]);
        } return [successset, failedset];
    }
    /**
     * 根据已经识别出来的，统计行的位置和音符的高度
     * @param {Array} succSet 
     * @returns [avgHeight, [avgY of rows]]
     */
    static staticYH(succSet) {
        // 求范围
        let maxH = 0, maxY = 0;
        for (const box of succSet) {
            let bottom = box[1] + box[3];
            if (box[3] > maxH) maxH = box[3];
            if (bottom > maxY) maxY = bottom;
        }
        // 统计得高度
        let hvote = new Uint16Array(maxH + 1);
        // y轴使用投影法，合并后的区间根据重合的次数加权求中心
        let yvote = new Uint8ClampedArray(maxY + 2);    // 防止越界 最后多加一位用来做边界条件
        for (const box of succSet) {
            hvote[box[3]]++;
            for (let i = box[1], final = box[1] + box[3]; i < final; i++) {
                yvote[i]++;
            }
        }
        let avgH = JPrecoTools.argmax(hvote);   // 票数最多的高度
        let ys = [];
        const minNum = 4;   // 至少5个才计数
        const Hthreshold = (avgH * 0.6) | 0;
        for (let i = 0; i < yvote.length;) {
            while (yvote[i] <= minNum) i++;
            let sumy = i * yvote[i];
            let votes = yvote[i];
            let beginAt = i;
            while (yvote[i] > minNum) {
                sumy += i * yvote[i];
                votes += yvote[i];
                i++;
            }
            // 如果满足要求的高度区间大小够大，就算一个
            if (i - beginAt > Hthreshold) ys.push(Math.round(sumy / votes));
        }
        return [avgH, ys];
    }
    /**
     * 根据位置和形状，从识别成功的集合中删去误识别的对象
     * @param {number} H 识别成功的高度的众数，提供形状信息
     * @param {Array} yaxis 各行的y轴，提供位置信息
     * @param {Array<Array>} succSet 认为成功识别的box的集合
     * @returns [确实成功的集合, 筛选出的误识别]
     */
    static reduceBox(H, yaxis, succSet) {
        // 把带外的元素移出
        let successSet = [];
        let failedSet = [];
        succSet.sort((a, b) => a[1] - b[1]);
        let yid = -1;
        const halfH = Math.ceil(H * 0.55);
        function nextBoundary() {
            yid++;
            if (yid >= yaxis.length) return [Infinity, Infinity];
            return [yaxis[yid] - halfH - 2, yaxis[yid] + halfH];    // 上边界宽松一些，因为可能有升降号
        }
        let border = nextBoundary();
        for (const box of succSet) {
            let center = box[1] + (box[3] >> 1);
            while (center > border[1]) border = nextBoundary();
            if (center < border[0]) {
                // 设置一个严苛的判断条件，防止去掉同时演奏的音
                if (box[3] == H && box[2] * 5 > H) successSet.push(box);
                else failedSet.push(box);
            } else {
                if (box[3] > H * 1.4) failedSet.push(box);   // 更小的可能是倚音，大的肯定异常
                else successSet.push(box);
            }
        }
        return [successSet, failedSet];
    }

    /**
     * 在行附近，合并y方向上分开的boxes，作为待识别的box
     * @param {number} H 识别成功的高度的众数，提供形状信息
     * @param {Array} yaxis 各行的y轴，提供位置信息
     * @param {Array<Array>} failSet 认为是反例的box集合
     * @returns [复活赛打赢的集合, 仍认为不是正确的]
     */
    static addBox(H, yaxis, failSet) {
        let rowSet = Array.from(yaxis, _ => []);
        let failedSet = [];
        let successSet = [];
        // 将带内的按照行分类 排序准则：中心点
        failSet.sort((a, b) => a[1] - b[1] + ((a[3] - b[3]) >> 1));
        let yid = -1;
        const halfH = Math.ceil(H * 0.55);
        function nextBoundary() {
            yid++;
            if (yid >= yaxis.length) return [Infinity, Infinity];
            return [yaxis[yid] - halfH - 2, yaxis[yid] + halfH];    // 上边界宽松一些，因为可能有升降号
        }
        let border = nextBoundary();
        for (const box of failSet) {
            let center = box[1] + (box[3] >> 1);
            while (center > border[1]) border = nextBoundary();
            if (center < border[0] || center > border[1]) {
                failedSet.push(box);
            } else {
                rowSet[yid].push(box);
            }
        }

        // 对每行进行框的合并 针对的是上下分开的情况，故x方向要求重合，y方向允许分离一部分距离
        function ifCombine(boxl, boxr) {    // 要求boxl[0] <= boxr[0]
            // x方向需要重合一部分
            let xcoincide = Math.min(boxl[0] + boxl[2], boxr[0] + boxr[2]) - boxr[0];   // x方向重合的长度
            xcoincide /= 0.2;
            let xjudge = xcoincide > boxl[2] || xcoincide > boxr[2];
            // y方向距离的判断：可以容忍一部分的分离距离
            let y1 = boxl[1] - (boxr[1] + boxr[3]);     // 用box1的上边缘减去box2的下边缘
            let y2 = boxl[1] + boxl[3] - boxr[1];       // 用box1的下边缘减去box2的上边缘
            // 如果同号说明有重合
            let yjudge = (y1 * y2) <= 0;
            if (!yjudge) {   // 容忍一部分距离差
                if(Math.abs(boxr[2] - boxr[3]) <= 1 && boxr[2] + boxr[3] <= 7) return false;  // 对于小图片，可能会把音高点合并进去，需要排除
                yjudge = Math.min(Math.abs(y1), Math.abs(y2)) <= (Math.min(boxl[3], boxr[3]) >> 1);
            }
            return xjudge && yjudge;
        }
        // 合并
        for (const row of rowSet) {
            row.sort((a, b) => a[0] - b[0]);
            let lastCombined = false;
            for (let i = row.length - 1; i > 0; i--) {
                // 和前一个（x更小的box）进行合并
                const boxl = row[i - 1];
                const boxr = row.pop();
                if (ifCombine(boxl, boxr)) {
                    let newR = Math.max(boxl[0] + boxl[2], boxr[0] + boxr[2]);
                    let newB = Math.max(boxl[1] + boxl[3], boxr[1] + boxr[3]);
                    let newT = Math.min(boxl[1], boxr[1]);
                    let newL = boxl[0];
                    row[i - 1] = [newL, newT, newR - newL, newB - newT];
                    lastCombined = true;
                } else {
                    if (lastCombined) successSet.push(boxr);
                    else failedSet.push(boxr);
                    lastCombined = false;
                }
            }
            if (lastCombined) successSet.push(row[0]);
            else failedSet.push(row[0]);
        }
        // 对新增加的进行形状上的过滤
        const HL = H * 0.5; // 考虑到升降号
        const HH = H * 1.2;
        let fliterSet = [];
        for (let i = successSet.length - 1; i >= 0; i--) {
            const box = successSet[i];
            if (box[3] >= HH || !JPrecoTools.shapeFilter(box[2], box[3], HL)) {
                failedSet.push(box);
            } else {
                fliterSet.push(box);
            }
        }
        return [fliterSet, failedSet];
    }

    /**
     * 将升降记号、数字、音高点组合成JPnote
     * @param {Array<Array>} succSet 匹配成功的box的集合
     * @param {Array<Array>} failset 匹配失败的box的集合，包含音高点
     * @param {number} H 平均高度
     * @returns {Array<JPnote>}
     */
    static join(succSet, failset, H) {
        let succset = [...succSet]
        // 匹配升降号和数字
        succset.sort(JPrecoTools.XthenYsort);     // 先验：升降号在数字左边
        const notes = [];
        for (let i = 0; i < succset.length; i++) {
            const box = succset[i];
            if (box[4] == 0) continue;
            if (box[4] > 7) {
                // 向后遍历，直到距离过大
                const maxX = box[0] + (box[2] << 1);
                const threshold = 1 + ((box[2] + box[3]) >> 1);
                let j = i + 1;
                while (j < succset.length && succset[j][0] < maxX) {
                    if (succset[j][4] > 0 && succset[j][4] <= 7) {
                        // 求解距离 用符号的右边中心点和数字的左顶点之间的距离，用曼哈顿距离减少计算量
                        let dis = Math.abs(succset[j][0] - box[0] - box[2]) + Math.abs(succset[j][1] - box[1] - (box[3] >> 1));
                        if (dis <= threshold) {
                            notes.push(new JPnote(succset[j], box));
                            succset.splice(j, 1);
                            break;
                        }
                    } j = j + 1;
                }
            } else {
                notes.push(new JPnote(box));
            }
        }
        // 匹配八度点
        // 通过形状筛选出点
        let dots = [];
        let others = [];
        const maxdot2D = (H * 0.7) | 0;   // 长宽都要小于0.35H
        for (const box of failset) {
            if (box[2] + box[3] <= maxdot2D && Math.abs(box[2] - box[3]) <= 3) dots.push(box);
            else others.push(box);
        }
        dots.sort(JPrecoTools.XthenYsort);
        let maxlow = 0;
        let maxhigh = 0;
        for (const note of notes) {
            note.matchDots(dots);
            note.updateBox();
            if (note.dots.length) {
                if(note.dots[0][1] < note.num[1]) {
                    maxhigh = Math.max(maxhigh, note.num[1] - note.dots[note.dots.length - 1][1])
                } else {
                    maxlow = Math.max(maxlow, (note.box[1] + note.box[3]) - (note.num[1] + note.num[3]));
                }
            }
        }
        maxlow = maxlow / H;
        maxhigh = maxhigh / H;
        // 放宽标准重新识别
        for (const note of notes) {
            if(note.dots.length == 0) {
                note.matchDots(dots, -1, maxhigh, maxlow, H);
                note.updateBox();
            }
            note.updateNote();
        }
        return notes;
    }

    /**
     * 清空notes区域
     * @param {jsPic} jspicRGB 
     * @param {Array<JPnote>} notes 
     * @returns {jsPic} 清空了notes区域的jsPic
     */
    static iniEmpty(jspicRGB, notes) {
        const pic = jspicRGB.clone();
        for(const n of notes) {
            n.empty(pic);
        } return pic;
    }
    /**
     * 结合了otsu和自适应的二值化方法, 顺便翻转，修改传入的jspic的第一个通道
     * @param {jsPic} JSPIC 
     */
    static specialBinarization(JSPIC) { // pic必须是单通道的
        let otsuthreshold = JSPIC.otsu(0);    // 大津法阈值
        // 得到自适应的阈值
        let kernelh = 3;
        let kernel = jsPic.GaussianKernel(kernelh).flat();
        let filtered = JSPIC.filter2D({
            kernelSize: [kernelh, kernelh],
            fill: [255],
            pixfun: Ker => {
                let sum = 0;
                for (let i = 0; i < Ker.length; i++) sum += kernel[i] * Ker[i];
                return sum;
            }
        });
        // 应用阈值
        for (let i = 0; i < JSPIC.height; i++) {
            let channel = JSPIC.channel[0][i];
            let fc = filtered.channel[0][i];
            for (let j = 0; j < JSPIC.width; j++) {
                let threshold = Math.max(16, Math.min(otsuthreshold, fc[j] - 1));
                channel[j] = channel[j] > threshold ? 0 : 255;
            }
        }
    }
    /**
     * 求两个包围盒的重合面积
     * @param {Array} box1 [x1,y1,w1,h1]
     * @param {Array} box2 [x2,y2,w2,h2]
     * @returns {number} 重叠面积
     */
    static overlap(box1, box2) {
        let x1 = Math.max(box1[0], box2[0]);
        let y1 = Math.max(box1[1], box2[1]);
        let x2 = Math.min(box1[0] + box1[2], box2[0] + box2[2]);
        let y2 = Math.min(box1[1] + box1[3], box2[1] + box2[3]);
        if (x1 > x2 || y1 > y2) return 0;
        return (x2 - x1 + 1) * (y2 - y1 + 1);
    }
    /**
     * 合并boxes，如果两个boxes的重叠面积超过一定值，则合并
     * @param {Array<Array>} set box集合，每个元素都是[x,y,w,h]
     * @param {function} ifmerge 判断是否合并的函数，参数为两个box，返回值为boolean，true则合并
     * @returns {Array<Array>} 合并的集合
     */
    static nms(set, ifmerge = (box1, box2) => JPrecoTools.overlap(box1, box2) > 3) {
        let result = [];
        for (let i = 0; i < set.length; i++) {
            const box = set[i];
            let notmerge = true;
            for (let j = i + 1; j < set.length; j++) {
                const box_ = set[j];
                if (ifmerge(box, box_)) {
                    let r = Math.max(box_[0] + box_[2], box[0] + box[2]);
                    let b = Math.max(box_[1] + box_[3], box[1] + box[3]);
                    box_[0] = Math.min(box_[0], box[0]);
                    box_[1] = Math.min(box_[1], box[1]);
                    box_[2] = r - box_[0];
                    box_[3] = b - box_[1];
                    notmerge = false;
                    break;
                }
            }
            if (notmerge) result.push(box);
        }
        return result;
    }
    // 线性均衡，最大值拉伸为255，最小值拉伸为0
    // 修改原图的第一个通道
    static equalize(JSPIC) {
        let arrays = JSPIC.channel[0];
        let min = arrays[0][0];
        let max = min;
        for (const arr of arrays) {
            for (const val of arr) {
                min = Math.min(min, val);
                max = Math.max(max, val);
            }
        }
        let scale = 255 / (max - min);
        for (const arr of arrays) {
            for (let i = 0; i < arr.length; i++) {
                arr[i] = Math.round((arr[i] - min) * scale);
            }
        }
    }
    // 将区域转为标准输入，并进行均衡
    static cropToInput(JSPIC, loc) {
        const inputH = JPrecoTools.inputH;
        const inputW = JPrecoTools.inputW;
        let charpic = JSPIC.copy(...loc).resize(-1, inputH);
        if (!charpic) return null;
        let final;
        if (charpic.width > inputW) {
            final = charpic.copy((charpic.width - inputW) >> 1, 0, inputW, inputH);
        } else {
            final = new jsPic().new(1, inputW, inputH, [0]);
            final.paste((inputW - charpic.width) >> 1, 0, charpic);
        }
        JPrecoTools.equalize(final);
        return final;
    }
    static argmax(arr) {
        let max = arr[0];
        let maxIndex = 0;
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] > max) {
                maxIndex = i;
                max = arr[i];
            }
        } return maxIndex;
    }
    static shapeFilter(w, h, minh = 6) {
        // 过滤掉太小的区域
        if (h < minh) return false;
        // 过滤掉形状不对的区域
        let hwr = h / w;
        if (hwr < 1.1 || hwr > 6) return false;
        return true;
    }
    static XthenYsort(a, b) {
        let x = a[0] - b[0];
        if (x == 0) return a[1] - b[1];
        return x;
    }
};

export {jsPic};
export {JPnote};