您使用括号创建新文件夹时()，文件夹名称不会包含在 URL 路径中。
因此，/dashboard/(overview)/page.tsx会变成/dashboard。

页面级流式传输，直接使用loading.tsx，然后导入骨架skeleton

也可以使用 React Suspense 实现更精细的控制，只流式传输特定组件。