package operation_setting

import "testing"

func TestResolveMinTopUpForGroup(t *testing.T) {
	// 保存并恢复全局状态，避免污染其它测试
	saved := paymentSetting.GroupMinTopUp
	defer func() { paymentSetting.GroupMinTopUp = saved }()

	paymentSetting.GroupMinTopUp = map[string]int{
		"企业":    500, // 高于渠道最低
		"cheap": 5,   // 低于渠道最低
		"exact": 10,  // 等于渠道最低
	}
	const channelMin = 10

	cases := []struct {
		name  string
		group string
		want  int
	}{
		{"configured higher wins", "企业", 500},
		{"configured lower falls back to channel", "cheap", channelMin},
		{"configured equal keeps channel", "exact", channelMin},
		{"unconfigured group soft-falls-back", "vip", channelMin},
		{"default group uses channel", DefaultUserGroup, channelMin},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := ResolveMinTopUpForGroup(c.group, channelMin); got != c.want {
				t.Fatalf("group=%q channelMin=%d: got %d, want %d", c.group, channelMin, got, c.want)
			}
		})
	}
}
