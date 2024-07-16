/**
 * @description a picture tool
 * @author madderscientist.github
 * @DataStruct
 *  jsPic has three attributes:
 *  channel [
 *      channel_1 [
 *          Uint8ClampedArray_1 [value_1, value_2, ...],
 *          Uint8ClampedArray_2 [...],
 *          ...
 *      ],
 *      channel_2 [...],
 *      ...
 *  ]
 *  height
 *  width
 * @example
 *  let j = new jsPic().fromImageData(imagedata,'L')
 *  j = j.convolution({kernel:jsPic.Laplacian, picfun:(x=>Math.abs(x)>200?255:0), padding:[1,1]})
 */

// 微信小程序专供
class ImageData {
    static c = null;
    constructor(data, w, h) {
        return ImageData.c.createImageData(data, w, h);
    }
}
// 需要先执行jsPic.initImageData(ctx)
export default class jsPic {
    static initImageData(c) {
        ImageData.c = c;
    }
    // useful kernels
    static Gaussian = [[0.0625, 0.125, 0.0625], [0.125, 0.25, 0.125], [0.0625, 0.125, 0.0625]];
    static Prewitt_H = [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]];
    static Prewitt_V = [[-1, -1, -1], [0, 0, 0], [1, 1, 1]];
    static Sobel_H = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    static Sobel_V = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
    static Laplacian = [[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]];
    /**
     * normalized Gaussian kernel
     * @param {number} n 尺寸
     * @returns {Array<Array>} 2D square array
     */
    static GaussianKernel(n) {
        let kernel = new Array(n);
        let sum = 0;
        let c = n >> 1;
        for (let i = 0; i < n; i++) {
            kernel[i] = new Array(n);
            for (let j = 0; j < n; j++) {
                kernel[i][j] = Math.exp(-((i - c) ** 2 + (j - c) ** 2) / 2);
                sum += kernel[i][j];
            }
        }
        for (let i = 0; i < n; i++)
            for (let j = 0; j < n; j++)
                kernel[i][j] /= sum;
        return kernel;
    }

    /**
     * new a jsPic from param
     * @param {number | Array} channel if number, initialize data filled with param 'fill'; if Array, use it directly
     * @param {number} width the picture's width. If channel is Array, this value will be automatically set
     * @param {number} height the picture's height
     * @param {Int8Array} fill fill[i] = channel{i}'s default value (only used when 'channel' is a number)
     * @returns {jsPic} overwirte and return itself
     */
    new(channel, width, height, fill = [255, 255, 255, 255]) {
        if (Array.isArray(channel)) {
            this.channel = channel;
            this.width = channel[0][0].length;
            this.height = channel[0].length;
        } else {
            this.width = width;
            this.height = height;
            this.channel = Array.from({ length: channel }, (_, i) => this.newChannel(fill[i]));
        }
        return this;
    }

    /**
     * new a channel filled with 'fill'
     * @param {number} fill default value
     * @returns {Array} a channel
     */
    newChannel(fill = 0) {
        let Channel = new Array(this.height);
        for (let h = 0; h < this.height; h++)
            Channel[h] = new Uint8ClampedArray(this.width).fill(fill);
        return Channel;
    }

    /**
     * deeply copy a channel
     * @param {number} channel target channel index
     * @returns {Array} copy
     */
    cloneChannel(channel) { return Array.from(this.channel[channel], (line) => new Uint8ClampedArray(line)); }

    /**
     * deeply clone a jsPic
     * @returns {jsPic} copy
     */
    clone() { return new jsPic().new(Array.from(this.channel, (_, index) => this.cloneChannel(index))); }

    /**
     * get a pixel at (x,y)
     * @param {number} x
     * @param {number} y
     * @returns {Array} [channel_1, channel_2, ... ]
     */
    getPixel(x, y) {
        let p = new Uint8ClampedArray(this.channel.length);
        for (let i = 0; i < this.channel.length; i++) p[i] = this.channel[i][y][x];
        return p;
    }

    /**
     * traverse this.channel[channel], replacing each value with mapfn(value)
     * @param {number | Array} channel target channel index or channel object
     * @param {Function} mapfn input: each value; its output will be used
     */
    throughChannel(channel, mapfn = (v, x, y) => v) {
        if (typeof channel === 'number') channel = this.channel[channel];
        for (let h = 0; h < this.height; h++)
            for (let w = 0; w < this.width; w++)
                channel[h][w] = mapfn(channel[h][w], w, h);
    }

    /**
     * traverse all channels together, replacing each pixel with mapfn(pixel)
     * @param {Function} pixfun input: [channel_1, channel_2, ... ]; its output will be distributed to each channel
     * @returns {jsPic} change and return itself
     */
    throughPic(pixfun = x => { return x; }) {
        for (let h = 0; h < this.height; h++) {
            for (let w = 0; w < this.width; w++) {
                let after = pixfun(this.getPixel(w, h));
                for (let c = 0; c < this.channel.length; c++)
                    this.channel[c][h][w] = after[c];
            }
        } return this;
    }

    /**
     * construct jsPic from ImageData
     * @param {ImageData} ImgData ImageData from html canvas
     * @param {String} mode convert mode:'RGB'|'RGBA'|'L'|'1' (convert here is quicker than convert afterwards)
     * @param {number} threshold only used when mode = '1'
     * @returns {jsPic} overwrite and return itself
     */
    fromImageData(ImgData, mode = 'RGBA', threshold = 127) {
        this.height = ImgData.height;
        this.width = ImgData.width;
        let d = ImgData.data;
        switch (mode) {
            case 'RGBA': case 'RGB': {
                let l = mode.length;
                this.channel = new Array(l);
                for (let c = 0; c < l; c++) {
                    let Channel = new Array(this.height);
                    for (let h = 0, k = c; h < this.height; h++) {
                        let Line = new Uint8ClampedArray(this.width);
                        for (let w = 0; w < this.width; w++, k += 4) Line[w] = d[k];
                        Channel[h] = Line;
                    } this.channel[c] = Channel;
                } break;
            }
            case 'L': {
                let Channel = new Array(this.height);
                for (let h = 0, k = 0; h < this.height; h++) {
                    let Line = new Uint8ClampedArray(this.width);
                    for (let w = 0; w < this.width; w++, k += 4)
                        Line[w] = d[k] * 0.299 + d[k + 1] * 0.587 + d[k + 2] * 0.114;
                    Channel[h] = Line;
                } this.channel = [Channel];
                break;
            }
            case '1': {
                let Channel = new Array(this.height);
                for (let h = 0, k = 0; h < this.height; h++) {
                    let Line = new Uint8ClampedArray(this.width);
                    for (let w = 0; w < this.width; w++, k += 4)
                        Line[w] = d[k] * 0.299 + d[k + 1] * 0.587 + d[k + 2] * 0.114 > threshold ? 255 : 0;
                    Channel[h] = Line;
                } this.channel = [Channel];
                break;
            }
        }
        return this;
    }

    /**
     * construct ImageData from jsPic
     * @param {Array} select select 4 channels to form ImageData, ImageData's channel[i] = this.channel[select[i]]
     * @param {Array} fill use channel filled with fill[i] when select[i] is illegal
     * @returns {ImageData}
     */
    toImageData(select = [0, 1, 2, 3], fill = [255, 255, 255, 255]) {
        if (select.length != 4 || fill.length != 4) {
            console.error("index error!"); return null;
        }
        let data = new Uint8ClampedArray(4 * this.width * this.height);
        let k = 0;
        for (let h = 0; h < this.height; h++) {
            for (let w = 0; w < this.width; w++) {
                for (let c = 0; c < 4; c++) {
                    // 如果select[c]不合法则用fill填充
                    if (select[c] >= this.channel.length || select[c] < 0) data[k++] = fill[c];
                    else data[k++] = this.channel[select[c]][h][w];
                }
            }
        }
        return new ImageData(data, this.width, this.height);
    }

    /**
     * mode convert without changing itself
     * @param {String} mode 'L' | '1' | 'RGB'
     * @param {number} threshold only used when mode='1'; for otsu method please use .convert_1 after converting to 'L'
     * @returns {jsPic} new jsPic
     */
    convert(mode = 'L', threshold = 127) {
        switch (mode) {
            case 'L':       // gray
                if (this.channel.length < 3) break;
                let C = new Array(this.height);
                for (let h = 0; h < this.height; h++) {
                    let L = new Uint8ClampedArray(this.width);
                    for (let w = 0; w < this.width; w++) {
                        L[w] = this.channel[0][h][w] * 0.299 + this.channel[1][h][w] * 0.587 + this.channel[2][h][w] * 0.114;
                    }
                    C[h] = L;
                }
                return new jsPic().new([C]);
            case '1':       // black & white
                if (this.channel.length >= 3) {
                    let L = this.convert('L');
                    L.convert_1(0, threshold);
                    return L;
                } else if (this.channel.length == 1) {
                    let C = new Array(this.height);
                    for (let h = 0; h < this.height; h++) {
                        let L = new Uint8ClampedArray(this.width);
                        for (let w = 0; w < this.width; w++) {
                            L[w] = this.channel[0][h][w] > threshold ? 255 : 0;
                        }
                        C[h] = L;
                    }
                    return new jsPic().new([C]);
                } else break;
            case 'RGB':
                if (this.channel.length == 3) return this.clone();
                else if (this.channel.length == 4)
                    return new jsPic().new(Array.from({ length: this.channel.length - 1 }, (_, index) => this.cloneChannel(index)));
                else break;
            default: console.error("unknown mode!"); return null;
        }
        console.error("channel number error!"); return null;
    }

    /**
     * Binarization one channel (change itself)
     * @param {number} channel target channel index
     * @param {number} threshold if -1, use otsu method
     */
    convert_1(channel, threshold = 127) {
        if (threshold < 0) threshold = this.otsu(channel);
        console.log(threshold);
        this.throughChannel(channel, (x) => { return x > threshold ? 255 : 0; });
    }

    /**
     * statistic of the channel
     * @param {number} channel which channel to statistic
     * @returns {Uint32Array} histogram of the channel
     */
    histogram(channel = 0) {
        let hist = new Uint32Array(256);    // 用Uint16会溢出
        let c = this.channel[channel];
        for (let h = 0; h < this.height; h++) {
            let cc = c[h];
            for (let w = 0; w < this.width; w++)
                hist[cc[w]]++;
        } return hist;
    }

    /**
     * ostu method to get the binary threshold of a channel
     * @param {number} channel channel to get the threshold
     * @returns {number} threshold
     */
    otsu(channel = 0) {
        let hist = this.histogram(channel);
        let PointNum = this.width * this.height; // 求和
        let All = 0;
        for (let i = 0; i < 256; i++) All += i * hist[i];
        let bSum = 0;
        let bNum = 0;
        let wNum = 0;
        let varMax = 0;
        let threshold = 0;
        for (let i = 0; i < 256; i++) {
            bNum += hist[i];  // 左侧的像素数目
            if (bNum == 0) continue;
            wNum = PointNum - bNum;  // 右侧的像素数目
            if (wNum == 0) break;
            bSum += i * hist[i];    // 左侧的灰度总和
            let mean_dis = bSum / bNum - (All - bSum) / wNum;
            let varBetween = bNum * wNum * mean_dis * mean_dis;
            if (varBetween > varMax) {
                varMax = varBetween;
                threshold = i;
            }
        } return threshold;
    }

    /**
     * an opening convolution focusing on each channel. All the operators is defind in pixfun, whose parameter is the 1D-Array of values masked by kernel
     * @param {Object} settings
     * @param {[number, number]} settings.kernel - kernel size: [width, height]. Odd number is suggested.
     * @param {[number, number]} settings.stride - [Xstride, Ystride]. Default is [1, 1]
     * @param {[number, number]} settings.padding - padding size: [paddingWidth, paddingHeight]. If -1, padding = kernelSize >> 1
     * @param {[number, number]} settings.fill - if fill[i] < 0, the nearliest pixel value will be used; else this.channel[select[i]] will be filled with fill[i].
     * @param {Function} settings.pixfun - how to process the kernel. Input is the 1D-Array of values masked by kernel, and its anchor coordinate, output is the pixel value.
     * @param {Array} settings.select - only picks channels to convolute, and its order doesn't matter. Unselected channels will be copied.
     * @returns new jspic, which has the same channel count as the original one
     */
    filter2D({ kernelSize = [3, 3], stride = [1, 1], padding = [-1, -1], fill = [127, 127, 127, 0], pixfun = (Ker, x, y) => Math.max(...Ker), select = [0, 1, 2] }) {
        let [kernelW, kernelH] = kernelSize;
        if (padding[0] < 0) padding[0] = kernelW >> 1;
        if (padding[1] < 0) padding[1] = kernelH >> 1;
        let newHeight = Math.floor((this.height + 2 * padding[1] - kernelH) / stride[1] + 1);
        let newWidth = Math.floor((this.width + 2 * padding[0] - kernelW) / stride[0] + 1);
        let C = new Array(this.channel.length);
        for (let c = 0; c < this.channel.length; c++) {
            let i = select.indexOf(c);
            if (i != -1) {
                let cha = new Array(newHeight);
                for (let h = -padding[1], H = 0; h < this.height + padding[1] - kernelH + 1; h += stride[1], H++) {
                    let L = new Uint8ClampedArray(newWidth);
                    for (let w = -padding[0], W = 0; w < this.width + padding[0] - kernelW + 1; w += stride[0], W++) {
                        // 遍历卷积核
                        let Ker = Array(kernelW * kernelH);
                        let ki = 0;
                        for (let hh = 0; hh < kernelH; hh++) {
                            for (let ww = 0; ww < kernelW; ww++, ki++) {
                                let kh = h + hh;
                                let kw = w + ww;
                                let value = fill[i];
                                let wjudge = kw < 0 || kw >= this.width;
                                let hjudge = kh < 0 || kh >= this.height
                                if (wjudge || hjudge) {
                                    if (value < 0) {    // 找最近的图片点
                                        if (wjudge) kw = Math.min(Math.max(0, kw), this.width - 1);
                                        if (hjudge) kh = Math.min(Math.max(0, kh), this.height - 1);
                                        value = this.channel[c][kh][kw];
                                    }
                                } else value = this.channel[c][kh][kw];
                                Ker[ki] = value;
                            }
                        } L[W] = pixfun(Ker, w, h);
                    } cha[H] = L;
                } C[c] = cha;
            } else {
                if (newHeight == this.height && newWidth == this.width) C[c] = this.cloneChannel(c);
                else {  // 若大小变化，多了填充255，少了剪裁，左上角对齐
                    console.warn('channel size not match!');
                    let Channel = new Array(newHeight);
                    for (let hh = 0, minh = Math.min(newHeight, this.height); hh < minh; hh++) {
                        let x = new Uint8ClampedArray(newWidth).fill(255);
                        for (let ww = 0, minw = Math.min(newWidth, this.width); ww < minw; ww++) {
                            x[ww] = this.channel[c][hh][ww];
                        } Channel[h] = x;
                    } C[c] = Channel;
                }
            }
        }
        return new jsPic().new(C);
    }

    /**
     * convoluion on selected channels
     * @param {Object} setting refer to filter2D
     * @param {Array} setting.kernel 2D array
     * @returns new jsPic
     */
    convolution({ kernel, stride = [1, 1], padding = [-1, -1], fill = [127, 127, 127, 0], pixfun = x => { return x; }, select = [0, 1, 2] }) {
        let kernelW = kernel[0].length;
        let kernelH = kernel.length;
        kernel = kernel.flat();
        return this.filter2D({
            kernelSize: [kernelW, kernelH], select: select,
            stride: stride, padding: padding, fill: fill,
            pixfun: Ker => {
                let sum = 0;
                for (let i = 0; i < kernel.length; i++) sum += kernel[i] * Ker[i];
                return pixfun(sum);
            }
        });
    }

    /**
     * similar to opencv, but the border uses neighbour, anchor is center
     * @param {Array} shapeKernel mask of shape, 0 means ignore
     * @returns a new jspic
     */
    erode(shapeKernel = [[1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1]]) {
        let w = shapeKernel[0].length;
        let h = shapeKernel.length;
        let c = this.channel.length;
        shapeKernel = shapeKernel.flat();
        return this.filter2D({
            kernelSize: [w, h],
            padding: [Math.floor(w / 2), Math.floor(h / 2)],
            fill: Array(c).fill(-1),
            select: Array.from({ length: c }, (_, x) => x),
            pixfun: function (ker) {
                let min = 255;
                for (let i = 0; i < w * h; i++) {
                    if (shapeKernel[i])
                        if (ker[i] < min) min = ker[i];
                }
                return min;
            }
        });
    }

    /**
     * similar to opencv, but the border uses neighbour, anchor is center
     * @param {Array} shapeKernel 
     * @returns a new jspic
     */
    dilate(shapeKernel = [[1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1]]) {
        let w = shapeKernel[0].length;
        let h = shapeKernel.length;
        let c = this.channel.length;
        shapeKernel = shapeKernel.flat();
        return this.filter2D({
            kernelSize: [w, h],
            padding: [Math.floor(w / 2), Math.floor(h / 2)],
            fill: Array(c).fill(-1),
            select: Array.from({ length: c }, (_, x) => x),
            pixfun: function (ker) {
                let max = 0;
                for (let i = 0; i < w * h; i++) {
                    if (shapeKernel[i])
                        if (ker[i] > max) max = ker[i];
                }
                return max;
            }
        });
    }

    /**
     * change selected channels' brightness
     * @param {String} mode 'gamma' | 'hsb' | 'linear'
     * @param {number} extent >0 meaning changes with mode
     * @param {Array} channels target channels' index
     * @returns {jsPic | null} change and return itself when succeeded. otherwise null
     */
    brighten(mode = 'gamma', extent = 1, channels = [0, 1, 2]) {
        switch (mode) {
            case 'gamma':
                extent = 1 / extent;
                let gammaMap = Array.from({ length: 256 }, (_, i) => 255 * Math.pow(i / 255, extent));
                for (let i = 0; i < channels.length; i++) this.throughChannel(i, x => gammaMap[x]);
                return this;
            case 'hsb':
                if (this.channel.length < 3 || channels.length != 3) break;
                return this.throughPic((pixel) => {
                    let hsb = rgbToHsb([pixel[channels[0]], pixel[channels[1]], pixel[channels[2]]]);
                    hsb[2] = Math.min(100, hsb[2] * extent);
                    let result = hsbToRgb(hsb);
                    for (let c = 0; c < 3; c++) pixel[channels[c]] = result[c];
                    return pixel;
                });
            case 'linear':
                for (let c = 0; c < channels.length; c++) {
                    this.throughChannel(channels[c], x => extent * x);
                    return this;
                }
            default: console.error("unknown mode!"); return null;
        }
        console.error("channel number error!"); return null;
    }

    /**
     * histogram equalization
     * @param {number} channel channel to apply
     * @returns this
     */
    equalizeHist(channel = 0) {
        let hist = new Array(256).fill(0);
        let c = this.channel[channel];
        // 求直方图
        for (let h = 0; h < this.height; h++)
            for (let w = 0; w < this.width; w++)
                hist[c[h][w]]++;
        let sum = hist.reduce((a, b) => a + b); // 求和
        let map = new Array(256);
        let sumHist = 0;
        for (let i = 0; i < 256; i++) {
            sumHist += hist[i];
            map[i] = Math.round(255 * sumHist / sum);   // 概率密度对应到像素
        }
        this.throughChannel(channel, x => map[x]);
        return this;
    }

    /**
     * fill all the holes satisfying the judge (255 is regarded as edge)
     * @param {number} channel target channel index
     * @param {*} judge given the area points array and perimeter points array, return ture means fill the area
     * @returns this
     */
    fillHole(channel = 0, judge = (area, perimeter) => true) {
        let copy = this.cloneChannel(channel);
        channel = this.channel[channel];
        let dx = [0, 0, 1, -1];
        let dy = [1, -1, 0, 0];
        let area, perimeter;
        let height = this.height, width = this.width;
        // 基于栈查找封闭区域
        function seek(seed = [0, 0]) {
            copy[seed[1]][seed[0]] = 1;
            let stack = [seed];
            area = [];
            perimeter = [];
            let edge = true;
            while (stack.length) {
                let at = stack.pop();
                area.push(at);
                copy[at[1]][at[0]] = 1;
                for (let i = 0; i < 4; i++) {
                    let nx = at[0] + dx[i];
                    let ny = at[1] + dy[i];
                    if (0 <= ny && ny < height && 0 <= nx && nx < width) {
                        if (copy[ny][nx] != 1) {
                            if (copy[ny][nx] == 255) perimeter.push([nx, ny]);
                            else {                      // 如果为0就入栈
                                stack.push([nx, ny]);
                                copy[ny][nx] = 1;       // 用1标记已访问
                            }
                        }
                    } else edge = false;    // 没有边界
                }
            } return edge;
        }
        for (let h = 0; h < this.height; h++) {
            for (let w = 0; w < this.width; w++) {
                if (copy[h][w] == 0) {
                    if (seek([w, h])) {
                        if (judge(area, perimeter)) {
                            for (let i = 0; i < area.length; i++) channel[area[i][1]][area[i][0]] = 255;
                        }
                    }
                }
            }
        }
        return this;
    }

    /**
     * resize via bilinear interpolation
     * @param {number} w if <=0, keeps the ratio
     * @param {number} h if <=0, keeps the ratio
     * @returns a new jspic (null if failed)
     */
    resize(w, h = -1) {
        if (w <= 0) {
            if (h > 0) w = this.width * h / this.height;
            else return null;
        }
        if (h <= 0) h = this.height * w / this.width;
        w = Math.round(w);
        h = Math.round(h);
        if (w <= 0 || h <= 0) return null;
        // 用双线性插值 映射法则: 放大的时候用点模型 缩小的时候用边模型
        let pw = w < this.width ? this.width / w : (this.width - 1.5) / (w - 1);
        let xmap = pw < 1 ? Array.from({ length: w }, (_, x) => x * pw) : Array.from({ length: w }, (_, x) => (x + 0.5) * pw - 0.5);
        let xl = new Float32Array(w);
        let xr = new Float32Array(w);
        for (let i = 0; i < w; i++) {
            let intx = Math.floor(xmap[i]);
            xl[i] = xmap[i] - intx;
            xr[i] = 1 - xl[i];
            xmap[i] = intx;
        }
        let ph = h < this.height ? this.height / h : (this.height - 1.5) / (h - 1);
        let ymap = ph < 1 ? Array.from({ length: h }, (_, y) => y * ph) : Array.from({ length: h }, (_, y) => (y + 0.5) * ph - 0.5);
        let yl = new Float32Array(h);
        let yr = new Float32Array(h);
        for (let i = 0; i < h; i++) {
            let inty = Math.floor(ymap[i]);
            yl[i] = ymap[i] - inty;
            yr[i] = 1 - yl[i];
            ymap[i] = inty;
        }
        let output = new jsPic().new(this.channel.length, w, h);
        for (let c = 0; c < this.channel.length; c++) {
            let ch = this.channel[c];
            for (ph = 0; ph < h; ph++) {
                for (pw = 0; pw < w; pw++) {
                    output.channel[c][ph][pw] =
                        xr[pw] * yr[ph] * ch[ymap[ph]][xmap[pw]] +          // 左上角
                        xl[pw] * yl[ph] * ch[ymap[ph] + 1][xmap[pw] + 1] +  // 右下角
                        xr[pw] * yl[ph] * ch[ymap[ph] + 1][xmap[pw]] +      // 左下角
                        xl[pw] * yr[ph] * ch[ymap[ph]][xmap[pw] + 1];       // 右上角
                }
            }
        }
        return output;
    }

    /**
     * Template Matching, using sum of squares of differences
     * @param {jsPic} template template picture
     * @param {number} ignorePix if template's pixel==ignorePix, it won't be calculated
     * @returns error map
     */
    TemplateMatch(template, ignorePix = -1) {
        let newW = this.width - template.width + 1;
        let newH = this.height - template.height + 1;
        let error = new Uint32Array(newH * newW);
        for (let c = 0; c < this.channel.length; c++) {
            let k = 0;
            for (let h = 0; h < newH; h++) {
                for (let w = 0; w < newW; w++, k++) {
                    // 遍历模版
                    for (let th = 0; th < template.height; th++) {
                        for (let tw = 0; tw < template.width; tw++) {
                            if (template.channel[c][th][tw] != ignorePix)
                                error[k] += (template.channel[c][th][tw] - this.channel[c][h + th][w + tw]) ** 2;
                        }
                    }
                }
            }
        }
        return error;
    }

    /**
     * copy part of jspic
     * @param {number} x left
     * @param {number} y top
     * @param {number} w area width
     * @param {number} h area height
     * @returns new jspic
     */
    copy(x, y, w, h) {
        let p = new jsPic().new(this.channel.length, w, h, [0, 0, 0, 0]);
        w = Math.min(x + w, this.width);
        h = Math.min(y + h, this.height);
        for (let yy = 0; y < h; y++, yy++)
            for (let j = x, xx = 0; j < w; j++, xx++)
                for (let c = 0; c < this.channel.length; c++)
                    p.channel[c][yy][xx] = this.channel[c][y][j];
        return p;
    }

    /**
     * mix jspic with another
     * @param {number} x left
     * @param {number} y top
     * @param {jsPic} jspic to be pasted
     * @param {function} picfun how to mix. Inputs are two pixels, return an Array
     */
    paste(x, y, jspic, picfun = (origin, cover) => cover) {
        let h = Math.min(this.height, jspic.height + y);
        let w = Math.min(this.width, jspic.width + x);
        for (let yy = 0; y < h; y++, yy++)
            for (let j = x, xx = 0; j < w; j++, xx++) {
                let pix = picfun(
                    Array.from(this.channel, (_, i) => this.channel[i][y][j]),
                    Array.from(jspic.channel, (_, i) => jspic.channel[i][yy][xx])
                );
                for (let c = 0; c < this.channel.length; c++)
                    this.channel[c][y][j] = typeof pix[c] === 'number' ? pix[c] : 0;
            }
    }

    /**
     * find the connected components: 8 neighborhood judgment connectivity
     * @param {number} channel channel to be processed
     * @param {number} threshold bigger than which is called "connected"
     * @returns [map, position]: map is the label map, position is the box of each component: [x,y,w,h,state(t or f)]
     */
    connectedComponents(channel = 0, threshold = 127) {
        channel = this.channel[channel];
        let map = new Array(this.height);   // 标记图
        for (let h = 0; h < this.height; h++)
            map[h] = new Uint16Array(this.width).fill(-1);
        let maxValue = map[0][0];
        let position = [];              // 位置表
        let id = 0;
        let seek = (x, y) => {
            let state = channel[y][x] > threshold;
            let locL = this.width, locR = 0, locT = this.height, locB = 0;  // 位置
            let stackX = [x], stackY = [y]; // 不用queue是因为shift开销大，用两个stack是因为比一个快了5倍
            while (stackX.length) {
                let w = stackX.pop();
                let h = stackY.pop();
                if (w < 0 || w >= this.width || h < 0 || h >= this.height) continue;
                if (map[h][w] != maxValue || state != (channel[h][w] > threshold)) continue;
                if (w < locL) locL = w;
                if (w > locR) locR = w;
                if (h < locT) locT = h;
                if (h > locB) locB = h;
                map[h][w] = id;
                stackX.push(w + 1, w - 1, w, w, w + 1, w - 1, w + 1, w - 1);
                stackY.push(h, h, h + 1, h - 1, h + 1, h + 1, h - 1, h - 1);
            }
            position.push([locL, locT, locR - locL + 1, locB - locT + 1, state]);
            id++;
        }
        for (let h = 0; h < this.height; h++)
            for (let w = 0; w < this.width; w++)
                if (map[h][w] == maxValue) seek(w, h);
        return [map, position];
    }

    /**
     * adaptiveThreshold
     * @param {number} channel which channel to process
     * @param {number | Array<Array>} KernelOrSize kernel or is width
     * @param {number} c the same meaning as OpenCV
     * @param {number} fill padding option like filter2D
     * @returns new jsPic with one channel
     */
    adaptiveThreshold(channel, KernelOrSize = jsPic.Gaussian, c = 2, fill = -1) {
        let kernel = KernelOrSize;
        if (typeof KernelOrSize === 'number') {
            kernel = Array.from({ length: KernelOrSize }, () => Array(KernelOrSize).fill(1));
        }
        let kernelSum = 0;
        for (let i = 0; i < kernel.length; i++)
            for (let j = 0; j < kernel[i].length; j++)
                kernelSum += kernel[i][j];
        let kernelh = kernel.length;
        kernel = kernel.flat();
        channel = this.channel[channel];
        let filtered = new jsPic().new([channel]);   // 引用
        filtered = filtered.filter2D({
            kernelSize: [kernelh, kernelh],
            fill: [fill],
            pixfun: Ker => {
                let sum = 0;
                for (let i = 0; i < Ker.length; i++) sum += kernel[i] * Ker[i];
                return (sum / kernelSum);
            }
        });
        let fc = filtered.channel[0];
        for (let i = 0; i < this.height; i++)
            for (let j = 0; j < this.width; j++)
                fc[i][j] = channel[i][j] > fc[i][j] - c ? 255 : 0;
        return filtered;
    }
}