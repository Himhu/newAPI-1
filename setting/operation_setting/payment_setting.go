package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// DefaultUserGroup 是系统内置的默认用户分组，享受渠道原始最低充值额。
const DefaultUserGroup = "default"

type PaymentSetting struct {
	AmountOptions  []int           `json:"amount_options"`
	AmountDiscount map[int]float64 `json:"amount_discount"` // 充值金额对应的折扣，例如 100 元 0.9 表示 100 元充值享受 9 折优惠
	// GroupMinTopUp 为各用户分组配置的最低充值额度（同各渠道原始单位）。
	// 未配置的分组软回退到渠道原始最低额，不阻断充值。
	GroupMinTopUp map[string]int `json:"group_min_topup"`

	ComplianceConfirmed    bool   `json:"compliance_confirmed"`
	ComplianceTermsVersion string `json:"compliance_terms_version"`
	ComplianceConfirmedAt  int64  `json:"compliance_confirmed_at"`
	ComplianceConfirmedBy  int    `json:"compliance_confirmed_by"`
	ComplianceConfirmedIP  string `json:"compliance_confirmed_ip"`
}

const CurrentComplianceTermsVersion = "v1"

// 默认配置
var paymentSetting = PaymentSetting{
	AmountOptions:  []int{10, 20, 50, 100, 200, 500},
	AmountDiscount: map[int]float64{},
	GroupMinTopUp:  map[string]int{},
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("payment_setting", &paymentSetting)
}

func GetPaymentSetting() *PaymentSetting {
	return &paymentSetting
}

// ResolveMinTopUpForGroup 返回指定分组在给定渠道原始最低额下的有效最低充值额。
// 已配置且更高的分组取分组值；未配置或不高于渠道原始额的分组软回退到 channelMin，
// 永不阻断充值——GroupMinTopUp 缺省不是错误。
func ResolveMinTopUpForGroup(group string, channelMin int) int {
	groupMin, ok := paymentSetting.GroupMinTopUp[group]
	if !ok || groupMin <= channelMin {
		return channelMin
	}
	return groupMin
}

func IsPaymentComplianceConfirmed() bool {
	return paymentSetting.ComplianceConfirmed &&
		paymentSetting.ComplianceTermsVersion == CurrentComplianceTermsVersion
}
