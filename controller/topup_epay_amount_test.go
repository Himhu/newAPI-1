package controller

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupEpayPayMoneyTest(t *testing.T) {
	t.Helper()
	oldDB, oldRedis := model.DB, common.RedisEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1) // each :memory: connection is a separate database
	require.NoError(t, db.AutoMigrate(&model.TopUp{}))
	model.DB = db
	common.RedisEnabled = false
	epayPayMoneyMu.Lock()
	epayPayMoneyReserved = map[int64]int64{}
	epayPayMoneyMu.Unlock()
	t.Cleanup(func() {
		model.DB, common.RedisEnabled = oldDB, oldRedis
		epayPayMoneyMu.Lock()
		epayPayMoneyReserved = map[int64]int64{}
		epayPayMoneyQuotes = map[string]epayPayMoneyQuote{}
		epayPayMoneyMu.Unlock()
		_ = sqlDB.Close()
	})
}

func createEpayTopUp(t *testing.T, tradeNo string, money float64, status string, createdAt int64) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.TopUp{
		UserId: 1, Amount: 10, Money: money, TradeNo: tradeNo, PaymentMethod: "alipay",
		PaymentProvider: model.PaymentProviderEpay, CreateTime: createdAt, Status: status,
	}).Error)
}

func cents(v float64) int64 { return decimal.NewFromFloat(v).Round(2).Shift(2).IntPart() }

func TestAllocateEpayPayMoneyOnlyAddsFractionUnderOneYuan(t *testing.T) {
	setupEpayPayMoneyTest(t)
	for range 99 {
		money, err := allocateEpayPayMoney(context.Background(), 10)
		require.NoError(t, err)
		c := cents(money)
		assert.True(t, c >= 1001 && c <= 1099, "money %v out of range", money)
	}
}

func TestAllocateEpayPayMoneySkipsPendingOrders(t *testing.T) {
	setupEpayPayMoneyTest(t)
	now := time.Now().Unix()
	// Occupy every slot except 10.42 with pending orders.
	for c := int64(1001); c <= 1099; c++ {
		if c == 1042 {
			continue
		}
		createEpayTopUp(t, "pending-"+decimal.NewFromInt(c).String(), decimal.NewFromInt(c).Shift(-2).InexactFloat64(), common.TopUpStatusPending, now)
	}
	money, err := allocateEpayPayMoney(context.Background(), 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1042), cents(money))

	_, err = allocateEpayPayMoney(context.Background(), 10)
	assert.ErrorIs(t, err, errEpayPayMoneyExhausted)
}

func TestAllocateEpayPayMoneyIgnoresFinishedExpiredAndOtherOrders(t *testing.T) {
	setupEpayPayMoneyTest(t)
	now := time.Now().Unix()
	old := now - int64(epayPayMoneyReserveWindow.Seconds()) - 60
	for c := int64(1001); c <= 1099; c++ {
		m := decimal.NewFromInt(c).Shift(-2).InexactFloat64()
		id := decimal.NewFromInt(c).String()
		createEpayTopUp(t, "success-"+id, m, common.TopUpStatusSuccess, now)
		createEpayTopUp(t, "expired-"+id, m, common.TopUpStatusPending, old)
		require.NoError(t, model.DB.Create(&model.TopUp{
			UserId: 1, Amount: 10, Money: m, TradeNo: "stripe-" + id, PaymentProvider: model.PaymentProviderStripe,
			CreateTime: now, Status: common.TopUpStatusPending,
		}).Error)
	}
	_, err := allocateEpayPayMoney(context.Background(), 10)
	require.NoError(t, err)
}

func TestAllocateEpayPayMoneyConcurrentRequestsGetDistinctAmounts(t *testing.T) {
	setupEpayPayMoneyTest(t)
	var wg sync.WaitGroup
	results := make(chan int64, 99)
	for range 99 {
		wg.Go(func() {
			money, err := allocateEpayPayMoney(context.Background(), 10)
			if err == nil {
				results <- cents(money)
			}
		})
	}
	wg.Wait()
	close(results)
	seen := map[int64]bool{}
	for c := range results {
		assert.False(t, seen[c], "duplicate pay amount %d", c)
		seen[c] = true
	}
	assert.Len(t, seen, 99)

	_, err := allocateEpayPayMoney(context.Background(), 10)
	assert.ErrorIs(t, err, errEpayPayMoneyExhausted)
}

func TestAllocateEpayPayMoneyKeepsFractionalBase(t *testing.T) {
	setupEpayPayMoneyTest(t)
	money, err := allocateEpayPayMoney(context.Background(), 13.5)
	require.NoError(t, err)
	c := cents(money)
	assert.True(t, c > 1350 && c < 1450, "money %v out of range", money)
}

// The wallet preview and the order must charge the same amount.
func TestQuoteEpayPayMoneyIsStableUntilConsumed(t *testing.T) {
	setupEpayPayMoneyTest(t)
	ctx := context.Background()
	first, err := quoteEpayPayMoney(ctx, 1, 10)
	require.NoError(t, err)
	for range 5 {
		again, err := quoteEpayPayMoney(ctx, 1, 10)
		require.NoError(t, err)
		assert.Equal(t, cents(first), cents(again))
	}
	consumeEpayPayMoneyQuote(ctx, 1, 10)
	next, err := quoteEpayPayMoney(ctx, 1, 10)
	require.NoError(t, err)
	assert.NotEqual(t, cents(first), cents(next), "a consumed amount is still reserved and must not be reused")
}

func TestQuoteEpayPayMoneyDiffersPerUserAndAmount(t *testing.T) {
	setupEpayPayMoneyTest(t)
	ctx := context.Background()
	a, err := quoteEpayPayMoney(ctx, 1, 10)
	require.NoError(t, err)
	b, err := quoteEpayPayMoney(ctx, 2, 10)
	require.NoError(t, err)
	assert.NotEqual(t, cents(a), cents(b))
	c, err := quoteEpayPayMoney(ctx, 1, 20)
	require.NoError(t, err)
	assert.True(t, cents(c) > 2000 && cents(c) < 2100)
	assert.Equal(t, cents(a), func() int64 { v, _ := quoteEpayPayMoney(ctx, 1, 10); return cents(v) }())
}

func TestQuoteEpayPayMoneyExpires(t *testing.T) {
	setupEpayPayMoneyTest(t)
	ctx := context.Background()
	first, err := quoteEpayPayMoney(ctx, 1, 10)
	require.NoError(t, err)
	epayPayMoneyMu.Lock()
	for k, q := range epayPayMoneyQuotes {
		q.expiry = time.Now().Unix() - 1
		epayPayMoneyQuotes[k] = q
	}
	epayPayMoneyMu.Unlock()
	next, err := quoteEpayPayMoney(ctx, 1, 10)
	require.NoError(t, err)
	assert.NotEqual(t, cents(first), cents(next))
}
