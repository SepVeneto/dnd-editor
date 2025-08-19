export default [{
  name: '基本组件',
  group: [
    {
      _name: '菜单项',
      _view: 'menuItem',
      _schema: 'menuItem',
      title: '标题',
      style: {
        width: 375,
        background: '#fff',
      },
    },
    {
      _name: '说明',
      _view: 'menuItem',
      _schema: 'desc',
      title: '说明',
      style: {
        background: '#fff',
      },
    },
    {
      _name: '容器',
      _view: 'container',
      _schema: 'container',
      isShow: 1,
      grid: 1,
      style: {
        boxSizing: 'border-box',
        columnGap: 10,
      },
      list: [],
    },
    {
      _name: '轮播',
      _view: 'swiper',
      _schema: 'swiper',
      style: {},
      list: [],
    },
    {
      _name: '图片',
      _view: 'image',
      _schema: 'image',
      _inContainer: 'canvas',
      img: '/favicon.ico',
      style: { width: 375 },
    },
    {
      _name: '文字',
      _view: 'text',
      _schema: 'text',
      _inContainer: 'canvas',
      style: {
        fontSize: 16,
        color: '#000000',
      },
      content: '文字',
    },
    {
      _name: '画布',
      _view: 'canvas',
      _schema: 'canvas',
      style: {},
      list: [],
    },
  ],
}]
