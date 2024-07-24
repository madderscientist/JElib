// Promise，加载path的图片到画布，返回ImageData
export function path2canvas(canvas, ctx, path) {
  return new Promise((resolve, reject) => {
    let pic = canvas.createImage();
    pic.onload = () => {
      canvas.width = pic.width;
      canvas.height = pic.height;
      ctx.drawImage(pic, 0, 0, canvas.width, canvas.height);
      const imgdata = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve(imgdata);
    };
    pic.onerror = (e) => {
      console.log(e);
      reject(e);
    };
    pic.src = path;
  })
}
// ImageData到画布
export function data2canvas(imgdata, ctx, c) {
  c.width = imgdata.width;
  c.height = imgdata.height;
  ctx.putImageData(imgdata, 0, 0);
}
// 保存画布 是异步的 没有做同步的处理
export function exportcanvas(canvas) {
  wx.canvasToTempFilePath({ //将canvas生成图片
    canvas: canvas,
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
    destWidth: canvas.width,
    destHeight: canvas.height,
    success: function (res) {
      wx.saveImageToPhotosAlbum({ //保存图片到相册
        filePath: res.tempFilePath,
        success: function () {
          wx.showToast({
            title: "生成图片成功！",
            duration: 1800
          });
        }
      })
    },
    fail: function (res) {
      console.log(res)
    }
  });
}