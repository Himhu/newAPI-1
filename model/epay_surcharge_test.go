package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createSurchargedEpayOrder(t *testing.T, userID int, tradeNo string, amount int64, baseMoney, paidMoney float64) {
	t.Helper()
	require.NoError(t, DB.Create(&TopUp{
		UserId: userID, Amount: amount, Money: paidMoney, TradeNo: tradeNo, PaymentMethod: "alipay",
		PaymentProvider: PaymentProviderEpay, CreateTime: common.GetTimestamp(), Status: common.TopUpStatusPending,
	}).Error)
	require.NoError(t, CreateEpayPaySurcharge(tradeNo, baseMoney))
}

func setQuotaPerUnitForTest(t *testing.T) {
	t.Helper()
	old := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = old })
}

func TestRechargeEpayCreditsSurcharge(t *testing.T) {
	truncateTables(t)
	setQuotaPerUnitForTest(t)
	user := insertUserForPaymentGuardTest(t, 601, 0)
	createSurchargedEpayOrder(t, user.Id, "EPAYSURCHARGE1", 10, 10, 10.37)

	_, err := RechargeEpay("EPAYSURCHARGE1", "alipay", "127.0.0.1")
	require.NoError(t, err)
	// 10 yuan at 1 yuan/unit + 0.37 surcharge -> 10.37 units
	assert.Equal(t, 5_185_000, getUserQuotaForPaymentGuardTest(t, user.Id))
}

func TestRechargeEpayScalesSurchargeByOrderPrice(t *testing.T) {
	truncateTables(t)
	setQuotaPerUnitForTest(t)
	user := insertUserForPaymentGuardTest(t, 602, 0)
	// 10 units sold for 8.00 (discount); paid 8.40 -> 0.40 extra is worth 0.5 units
	createSurchargedEpayOrder(t, user.Id, "EPAYSURCHARGE2", 10, 8, 8.40)

	_, err := RechargeEpay("EPAYSURCHARGE2", "alipay", "127.0.0.1")
	require.NoError(t, err)
	assert.Equal(t, 5_250_000, getUserQuotaForPaymentGuardTest(t, user.Id))
}

func TestRechargeEpayWithoutSurchargeRecordCreditsBaseAmount(t *testing.T) {
	truncateTables(t)
	setQuotaPerUnitForTest(t)
	user := insertUserForPaymentGuardTest(t, 603, 0)
	require.NoError(t, DB.Create(&TopUp{
		UserId: user.Id, Amount: 10, Money: 10.37, TradeNo: "EPAYLEGACY", PaymentMethod: "alipay",
		PaymentProvider: PaymentProviderEpay, CreateTime: common.GetTimestamp(), Status: common.TopUpStatusPending,
	}).Error)

	_, err := RechargeEpay("EPAYLEGACY", "alipay", "127.0.0.1")
	require.NoError(t, err)
	assert.Equal(t, 5_000_000, getUserQuotaForPaymentGuardTest(t, user.Id))
}

func TestManualCompleteEpayCreditsSurcharge(t *testing.T) {
	truncateTables(t)
	setQuotaPerUnitForTest(t)
	user := insertUserForPaymentGuardTest(t, 604, 0)
	createSurchargedEpayOrder(t, user.Id, "EPAYSURCHARGE3", 100, 100, 100.4)

	require.NoError(t, ManualCompleteTopUp("EPAYSURCHARGE3", "127.0.0.1"))
	assert.Equal(t, 50_200_000, getUserQuotaForPaymentGuardTest(t, user.Id))
}
