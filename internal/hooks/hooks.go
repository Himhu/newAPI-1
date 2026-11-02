// Package hooks 提供内部编译期扩展点（业务事件），供自研功能（如邀请返利）订阅，
// 避免在上游维护的核心支付/订阅/兑换码代码里直接内联调用具体功能函数。
// 未来同步上游版本时，这些调用点只是稳定的单行事件通知，不携带具体业务逻辑，
// 冲突概率和排查成本都远低于内联实现。
//
// Handler 与调用方共用同一个 tx、同步执行：返回非 nil error 会中止调用方事务，
// 语义与被替换前的直接函数调用完全一致。
package hooks

import "gorm.io/gorm"

// TopupSource 标识充值额度的来源。
type TopupSource string

const (
	TopupSourceOnline TopupSource = "online"       // 用户自助支付（Stripe/Creem/Waffo/WaffoPancake/Epay）
	TopupSourceAdmin  TopupSource = "admin_manual" // 管理员手动补单
)

// TopupCreditedFunc 在充值额度写入用户账户后、同一事务内同步调用。
type TopupCreditedFunc func(tx *gorm.DB, userId int, quota int, tradeNo string, paymentMethod string, source TopupSource) error

// SubscriptionPaidFunc 在订阅订单标记为已支付、套餐生效后，同一事务内同步调用。
type SubscriptionPaidFunc func(tx *gorm.DB, userId int, quota int, tradeNo string, paymentMethod string) error

// RedemptionUsedFunc 在兑换码核销、额度写入用户账户后，同一事务内同步调用。
type RedemptionUsedFunc func(tx *gorm.DB, userId int, quota int, tradeNo string) error

var (
	topupCreditedHandlers    []TopupCreditedFunc
	subscriptionPaidHandlers []SubscriptionPaidFunc
	redemptionUsedHandlers   []RedemptionUsedFunc
)

// OnTopupCredited 注册 topup-credited 事件的订阅者，通常在功能包的 init() 中调用。
func OnTopupCredited(fn TopupCreditedFunc) {
	topupCreditedHandlers = append(topupCreditedHandlers, fn)
}

// OnSubscriptionPaid 注册 subscription-paid 事件的订阅者。
func OnSubscriptionPaid(fn SubscriptionPaidFunc) {
	subscriptionPaidHandlers = append(subscriptionPaidHandlers, fn)
}

// OnRedemptionUsed 注册 redemption-used 事件的订阅者。
func OnRedemptionUsed(fn RedemptionUsedFunc) {
	redemptionUsedHandlers = append(redemptionUsedHandlers, fn)
}

// EmitTopupCredited 按注册顺序同步触发所有 topup-credited 订阅者，遇错即停并返回。
func EmitTopupCredited(tx *gorm.DB, userId int, quota int, tradeNo string, paymentMethod string, source TopupSource) error {
	for _, fn := range topupCreditedHandlers {
		if err := fn(tx, userId, quota, tradeNo, paymentMethod, source); err != nil {
			return err
		}
	}
	return nil
}

// EmitSubscriptionPaid 按注册顺序同步触发所有 subscription-paid 订阅者，遇错即停并返回。
func EmitSubscriptionPaid(tx *gorm.DB, userId int, quota int, tradeNo string, paymentMethod string) error {
	for _, fn := range subscriptionPaidHandlers {
		if err := fn(tx, userId, quota, tradeNo, paymentMethod); err != nil {
			return err
		}
	}
	return nil
}

// EmitRedemptionUsed 按注册顺序同步触发所有 redemption-used 订阅者，遇错即停并返回。
func EmitRedemptionUsed(tx *gorm.DB, userId int, quota int, tradeNo string) error {
	for _, fn := range redemptionUsedHandlers {
		if err := fn(tx, userId, quota, tradeNo); err != nil {
			return err
		}
	}
	return nil
}
