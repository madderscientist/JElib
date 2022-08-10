Component({
  properties: {
    default: {
      type: Number,
      value: 0
    },
    // 距离选择器的高度
    top: {
      type: Number,
      value: 30
    },
    // 下拉选项
    options: {
      type: Array,
      value: [
        { id: 0, label: '蔽夏' },
        { id: 1, label: 'justice' },
        { id: 2, label: 'eternal' }
      ],
    },
    show: {
      type: Boolean,
      value: false
    },
    // 单个选项的高度
    height: {
      type: Number,
      value: 72
    },
    // 非必选项：展开一页所渲染的选项个数(用于计算滚动高度)
    limit: {
      type: Number,
      value: 2
    }
  },
  data: {
    texts: "",
    // 选中项{id:0,label:"???"}
    val: null,
    // 页面内联样式
    styles: {
      labelColor: 'grey',
      scrollHeight: 0
    },
    classNames: {
      open: ''
    },
    timer: null
  },
  lifetimes: {
    attached () {
      const {
        styles: prevStyles,
        height,
        limit,
        top
      } = this.data
      const styles = {
        ...prevStyles,
        scrollHeight: height * limit,
        top: `calc(100% + ${top}rpx)`,
      };
      this.setData({
        styles,
        val: this.data.options[this.data.default]
      });
    },
  },
  methods: {
    /**
     * 修改下拉框状态
     * @param show boolean
     */
    setStatus (show) {
      this.setData({ show })
    },
    // 选择框点击时间
    changeStatus () {
      this.data.show
        ? this.hideSelect()
        : this.showSelect()
    },
    showSelect () {
      this.setStatus(true)
    },
    hideSelect () {
      this.setStatus(false)
    },
    /**
     * 选择下拉选项的回调
     * @param e 下拉元素 用于获取dataset里对应的id
     */
    select (e) {
      const TIME_OUT = 800;
      const id = e.currentTarget.dataset.id;
      const val = this.data.options
        .find(option => option.id === id) || null;
      if (val && this.data.val && val.id === this.data.val.id) return;
      const fn = () => {
        this.setData({
          texts: val.label,
          val
        });
        this.hideSelect();
        // this.triggerEvent('select', val);
      }
      if (this.data.timer === null) {
        fn();
        return
      }
      this.data.timer && clearTimeout(this.data.timer);
      this.setData({
        timer: setTimeout(fn, TIME_OUT)
      })
    }
  },
  observers: {
    'val'(value) {
      const styles = {
        ...this.data.styles,
        labelColor: value ? '#000' : 'grey'
      };
      this.setData({
        styles,
        texts: (value && value.label) ? value.label : '请选择'
      });
      this.triggerEvent('select', value);
    },
    'show'(value) {
      const { classNames: prevClassNames } = this.data;
      const classNames = {
        ...prevClassNames,
        box: value ? 'select-box__view-box' : 'select-box__hidden-box',
        container: value ? '' : 'container--hidden'
      };
      this.setData({
        classNames
      })
    }
  }
})
