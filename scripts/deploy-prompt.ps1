# 弹出窗口输入 VPS 密码并部署（不把密码写进文件；明文+粘贴友好）
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = "KiriCut 输入 VPS 密码"
$form.Size = New-Object System.Drawing.Size(520, 240)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.TopMost = $true
$form.Font = New-Object System.Drawing.Font("Microsoft YaHei UI", 11)

$label = New-Object System.Windows.Forms.Label
$label.Location = New-Object System.Drawing.Point(20, 18)
$label.Size = New-Object System.Drawing.Size(460, 28)
$label.Text = "可直接粘贴密码后点确定"
$form.Controls.Add($label)

$hint = New-Object System.Windows.Forms.Label
$hint.Location = New-Object System.Drawing.Point(20, 48)
$hint.Size = New-Object System.Drawing.Size(460, 22)
$hint.ForeColor = [System.Drawing.Color]::DimGray
$hint.Text = "支持 Ctrl+V / 右键粘贴 / 中文输入法；部署目标 206.119.182.153:55716"
$form.Controls.Add($hint)

$box = New-Object System.Windows.Forms.TextBox
$box.Location = New-Object System.Drawing.Point(20, 80)
$box.Size = New-Object System.Drawing.Size(460, 32)
$box.Font = New-Object System.Drawing.Font("Consolas", 14)
$box.ShortcutsEnabled = $true
$box.UseSystemPasswordChar = $false
$box.ImeMode = [System.Windows.Forms.ImeMode]::On
$form.Controls.Add($box)

$mask = New-Object System.Windows.Forms.CheckBox
$mask.Location = New-Object System.Drawing.Point(20, 122)
$mask.Size = New-Object System.Drawing.Size(200, 28)
$mask.Text = "隐藏密码"
$mask.Checked = $false
$mask.Add_CheckedChanged({
  $box.UseSystemPasswordChar = $mask.Checked
})
$form.Controls.Add($mask)

$ok = New-Object System.Windows.Forms.Button
$ok.Text = "确定部署"
$ok.Location = New-Object System.Drawing.Point(260, 160)
$ok.Size = New-Object System.Drawing.Size(120, 36)
$ok.DialogResult = [System.Windows.Forms.DialogResult]::OK
$form.Controls.Add($ok)

$cancel = New-Object System.Windows.Forms.Button
$cancel.Text = "取消"
$cancel.Location = New-Object System.Drawing.Point(390, 160)
$cancel.Size = New-Object System.Drawing.Size(90, 36)
$cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$form.Controls.Add($cancel)

$form.AcceptButton = $ok
$form.CancelButton = $cancel
$form.Add_Shown({ $box.Focus(); $box.SelectAll() })

$result = $form.ShowDialog()
if ($result -ne [System.Windows.Forms.DialogResult]::OK -or [string]::IsNullOrWhiteSpace($box.Text)) {
  Write-Host "已取消"
  exit 1
}

$env:KIRICUT_VPS_PASSWORD = $box.Text
$box.Text = ""
$form.Dispose()

Set-Location (Split-Path $PSScriptRoot -Parent)
Write-Host "开始部署..."
npm run deploy:vps
$code = $LASTEXITCODE
if ($code -eq 0) {
  Write-Host ""
  Write-Host "部署完成。请打开 http://206.119.182.153 并 Ctrl+F5 硬刷新。"
} else {
  Write-Host "部署失败，退出码: $code"
}
Write-Host "按任意键关闭..."
[void][System.Console]::ReadKey($true)
exit $code
